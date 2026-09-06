package com.athlofit

import android.content.SharedPreferences
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * HealthSyncHelper
 *
 * Shared logic used by both WidgetUpdateWorker (periodic, every 15 min) and
 * EodSyncWorker (exact alarm at 23:59:50).
 *
 * Steps are read via aggregate() — the Health Connect API designed for
 * cumulative data. It automatically deduplicates overlapping records from
 * multiple sources and uses the most authoritative source (the device's
 * native step counter). This works correctly on every Android OEM without
 * any package-name allowlist.
 */
object HealthSyncHelper {

    private const val TAG = "HealthSyncHelper"
    private const val BASE_URL = "https://api.athlofit.com/"

    // ─── Public entry point ───────────────────────────────────────────────────

    suspend fun syncTodayAndYesterday(
        context: android.content.Context,
        prefs: SharedPreferences,
        token: String,
    ): Boolean {
        // Step tracking switched off for this account by an admin. Checked here
        // rather than only at the POST so we do not spend battery reading a
        // week of Health Connect records to build payloads the server will
        // reject anyway.
        if (!StepTrackingGate.isEnabled(context)) {
            Log.d(TAG, "Skipping sync — step tracking disabled for this account")
            return false
        }

        val client    = HealthConnectClient.getOrCreate(context)
        val weightKg  = prefs.getFloat("weightKg", 70.0f).toDouble()
        val zone      = ZoneId.systemDefault()
        val today     = LocalDate.now()

        // Midnight sync guard: if the native step service hasn't reset yet
        // (storedDate is yesterday but clock is past midnight), skip syncing
        // TODAY to prevent yesterday's stale steps from polluting today's record.
        val stepPrefs = context.getSharedPreferences("StepCounterPrefs", android.content.Context.MODE_PRIVATE)
        val storedDate = stepPrefs.getString("storedDate", "") ?: ""
        val todayStr = today.format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
        val nativeResetPending = storedDate.isNotEmpty() && storedDate != todayStr

        // Determine the earliest date to sync — the login date or 7 days ago, whichever is later.
        // FIX: Always sync from startOfDay for each day. The server has its own
        // accountCreatedDate guard to reject pre-account syncs.
        val sevenDaysAgo = today.minusDays(6) // today + 6 previous days = 7 days
        val startDate = sevenDaysAgo

        var anySuccess = false

        // Read the gap ONCE, before the first successful post moves the marker.
        // Reading it per-day would report ~0 for every day after the first, which
        // is the opposite of what a backlog looks like — the whole run is one
        // flush after one silence.
        val offlineMins = offlineMinutes(context)

        // Sync each day from startDate to today
        var current = startDate
        while (!current.isAfter(today)) {
            // FIX: Skip ONLY current day if native reset is pending AND we're syncing
            // today's date. ALWAYS sync historical days (yesterday and before) — the
            // native reset pending flag should NOT block historical data.
            // This prevents the Aug 7 zero-steps bug where EOD alarm fires after
            // midnight and skips yesterday's data because storedDate has already flipped.
            val isCurrentDayToday = current.isEqual(today)
            if (isCurrentDayToday && nativeResetPending) {
                Log.d(TAG, "[$current] Skipping TODAY only — native midnight reset pending (storedDate=$storedDate)")
                current = current.plusDays(1)
                continue
            }

            // FIX: Always pass 0L so each day reads from midnight (full day).
            // loginTimestamp filtering is no longer needed client-side.
            val tsForDay = 0L
            val dayData = readDaySnapshot(
                client, current, zone, weightKg, tsForDay, context.packageName, offlineMins,
                context,
            )
            if (dayData != null && dayData.optInt("steps") > 0) {
                val ok = postSync(token, dayData, context)
                Log.d(TAG, "[$current] sync ${if (ok) "OK" else "FAIL"} — ${dayData.optInt("steps")} steps")
                if (ok) anySuccess = true
            }
            current = current.plusDays(1)
        }

        return anySuccess
    }

    // ─── Read a single day's health snapshot ──────────────────────────────────

    private suspend fun readDaySnapshot(
        client:   HealthConnectClient,
        date:     LocalDate,
        zone:     ZoneId,
        weightKg: Double,
        loginTs:  Long,
        /** This app's package, so its own Health Connect records are excluded. */
        ownPackage: String,
        /** Minutes of silence before this sync run, or null if never synced. */
        offlineMins: Long?,
        /** For the cross-day origin history the dedup baseline is chosen from. */
        context: android.content.Context,
    ): JSONObject? {
        return try {
            val startOfDay = date.atStartOfDay(zone).toInstant()
            val endOfDay   = date.plusDays(1).atStartOfDay(zone).toInstant().minusMillis(1)
            val isToday    = date == LocalDate.now(zone)
            val endTime    = if (isToday) Instant.now() else endOfDay

            // Always read from startOfDay for steps — no loginTimestamp filtering.
            // This ensures the background sync reports the same step count as
            // the app, notification, and widget (all read from midnight).
            val stepsStart = startOfDay

            val stepsFilter  = TimeRangeFilter.between(stepsStart, endTime)
            val fullFilter   = TimeRangeFilter.between(startOfDay, endTime)
            val recentFilter = TimeRangeFilter.between(
                date.minusDays(1).atStartOfDay(zone).toInstant(), endTime)
            val monthFilter  = TimeRangeFilter.between(
                date.minusDays(30).atStartOfDay(zone).toInstant(), endTime)

            // ── Steps via readRecords() + coverage dedup ──────────────────────
            // aggregate() sums steps from ALL data origins — including third-party
            // apps like Sweatcoin, Google Fit, Samsung Health that also write
            // StepsRecord. This inflates the count vs the native step counter.
            //
            // Fix: read individual records, group by dataOrigin, and deduplicate
            // by RECORDING TIME. See StepOriginDedup for the rule and for why the
            // JS reader (healthConnect.service.ts) had to stop splitting records
            // across time slots. Both readers now run the same algorithm, so this
            // worker and the foreground sync no longer post different totals for
            // the same day — the server keeps the higher of the two, so a
            // disagreement was always resolved in favour of the larger number.
            val stepRecords = client.readRecords(
                ReadRecordsRequest(StepsRecord::class, stepsFilter)
            ).records

            // Self-exclusion uses the runtime package name, not a hardcoded literal.
            // The literal only matched the production applicationId, so on any variant
            // with a suffix (.debug, .staging) our own records were treated as an
            // external data source and could win the dedup below — the app reading
            // its own output back, which is the loop this filter exists to break.
            val externalRecords = stepRecords
                .filter { it.metadata.dataOrigin.packageName != ownPackage }
                .map {
                    StepOriginDedup.Record(
                        origin = it.metadata.dataOrigin.packageName,
                        count  = it.count,
                        start  = it.startTime.toEpochMilli(),
                        end    = it.endTime.toEpochMilli(),
                    )
                }

            // Origins this phone has actually been reading from, so an origin that
            // appeared today cannot take the baseline away from one that has been
            // here for days. See StepOriginHistory and the note at resolve().
            //
            // Recorded BEFORE resolving, and for every origin that was read rather
            // than only the winner — an origin has to accumulate days before it can
            // be preferred, and it can only do that while it is being demoted.
            val seenOrigins = externalRecords.map { it.origin }.toSet()
            StepOriginHistory.recordSeen(context, seenOrigins)

            val dedup = StepOriginDedup.resolve(
                externalRecords,
                StepOriginHistory.established(context),
            )

            // ── Provenance ───────────────────────────────────────────────────
            // Built from the same records the total is, so the attribution can
            // never describe a different figure than the one being posted.
            //
            // This worker is the path that matters most for attribution: it
            // re-posts the last seven days every 15 minutes, so it is the path
            // that flushes a backlog once a phone comes back online — which is
            // the single most common honest explanation for a five-figure jump,
            // and was indistinguishable from a counting bug from the server side.
            //
            // Only the records that were COUNTED go into the histogram. Feeding
            // it a mirrored origin as well would make the hours sum to about
            // double the deduplicated total they are meant to explain.
            val countedOrigins = buildSet {
                add(dedup.primaryOrigin)
                dedup.contributions.filter { it.contributed > 0 }.forEach { add(it.packageName) }
            }
            val hourly = StepOriginDedup.bucketByHour(
                externalRecords.filter { it.origin in countedOrigins },
                startOfDay.toEpochMilli(),
            )

            // Clamped like every other reader. This value is POSTed straight to the
            // server, so an absurd total written by some other app on the device would
            // otherwise reach the backend with only server-side validation in the way.
            val steps = dedup.steps
                .coerceIn(0L, MAX_SANE_DAILY_STEPS.toLong())
                .toInt()
            Log.d(TAG, "[$date] Steps dedup (excluding $ownPackage): ${dedup.describe()} → using $steps")

            // ── Derive calories / distance / activeMinutes from steps ──────────
            val calories      = (steps * (weightKg * 0.57) / 1000).toInt()
            val distanceKm    = Math.round(steps * (0.76 / 1000) * 100.0) / 100.0
            val activeMinutes = steps / 100

            // ── Heart rate ────────────────────────────────────────────────────
            // Use recentFilter (last 24h+) instead of fullFilter (today only) to
            // capture smartwatch data that spans midnight or syncs with older timestamps.
            val hrRecords = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, recentFilter))
                .records
            val allBpms = hrRecords.flatMap { it.samples }.map { it.beatsPerMinute }

            // Prefer today's samples for the display value, fall back to all recent
            val todayBpms = hrRecords
                .filter { it.startTime >= startOfDay }
                .flatMap { it.samples }
                .map { it.beatsPerMinute }
            val bpms = if (todayBpms.isNotEmpty()) todayBpms else allBpms

            val heartRate    = if (bpms.isNotEmpty()) (bpms.sum() / bpms.size).toInt() else 0
            val heartRateMin = bpms.minOrNull()?.toInt() ?: 0
            val heartRateMax = bpms.maxOrNull()?.toInt() ?: 0
            Log.d(TAG, "[$date] HR: ${hrRecords.size} records, ${allBpms.size} total samples, ${todayBpms.size} today samples, avg=$heartRate")

            // ── Blood pressure ────────────────────────────────────────────────
            val bpRecords = client.readRecords(ReadRecordsRequest(BloodPressureRecord::class, recentFilter))
                .records
            val latestBp = bpRecords.lastOrNull()
            val systolic  = latestBp?.systolic?.inMillimetersOfMercury?.toInt() ?: 0
            val diastolic = latestBp?.diastolic?.inMillimetersOfMercury?.toInt() ?: 0
            Log.d(TAG, "[$date] BP: ${bpRecords.size} records in recent range, latest=${if (latestBp != null) "$systolic/$diastolic" else "none"}")

            // ── Sleep ─────────────────────────────────────────────────────────
            val sleepMs = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, recentFilter))
                .records.sumOf { it.endTime.toEpochMilli() - it.startTime.toEpochMilli() }
            val sleepHours = Math.round((sleepMs / 3_600_000.0) * 10.0) / 10.0

            // ── Weight ────────────────────────────────────────────────────────
            val weight = client.readRecords(ReadRecordsRequest(WeightRecord::class, monthFilter))
                .records.lastOrNull()?.weight?.inKilograms
                ?.let { Math.round(it * 10.0) / 10.0 } ?: 0.0

            // ── Blood glucose ─────────────────────────────────────────────────
            val bloodGlucose = client.readRecords(ReadRecordsRequest(BloodGlucoseRecord::class, recentFilter))
                .records.lastOrNull()?.level?.inMillimolesPerLiter
                ?.let { Math.round(it * 10.0) / 10.0 } ?: 0.0

            // ── Hydration ─────────────────────────────────────────────────────
            val hydrationMl = client.readRecords(ReadRecordsRequest(HydrationRecord::class, fullFilter))
                .records.sumOf { it.volume.inLiters * 1000.0 }.toInt()

            JSONObject().apply {
                put("date",                   date.toString())
                // Device timezone (IANA name), as every other sync path already
                // sends. This payload used to omit it, and the omission was not
                // harmless just because `date` is explicit: the server resolves the
                // write target as `date || resolveClientDate(timezone)` but computes
                // `actualToday = resolveClientDate(timezone)` SEPARATELY, and that
                // helper falls back to hardcoded Asia/Kolkata when timezone is
                // missing. For any user outside IST the two disagreed on the days
                // the dates diverge, `isTodaySync` came out false, and today's coins
                // were diverted to the retroactive award branch instead of the
                // atomic same-day one.
                put("timezone",               ZoneId.systemDefault().id)
                put("steps",                  steps)
                put("calories",               calories)
                put("distance",               distanceKm)
                put("activeMinutes",          activeMinutes)
                put("heartRate",              heartRate)
                put("heartRateMin",           heartRateMin)
                put("heartRateMax",           heartRateMax)
                put("bloodPressureSystolic",  systolic)
                put("bloodPressureDiastolic", diastolic)
                put("sleepHours",             sleepHours)
                put("weight",                 weight)
                put("bloodGlucose",           bloodGlucose)
                put("hydration",              hydrationMl)
                put("stepSource",             buildStepSource(dedup, externalRecords, hourly, offlineMins))
                // `goalMet` is deliberately NOT sent. This worker does not know the
                // user's current goal (it would have to guess a default) and it does
                // not know about admin-credited bonus steps, both of which the server
                // has. Sending a hardcoded `false` was worse than sending nothing: the
                // server read it with `??`, which does not fall through on `false`, so
                // a user who only ever syncs in the background could never have the
                // goal recorded as met — no daily step-goal coins, and no streak.
            }
        } catch (e: Exception) {
            Log.e(TAG, "readDaySnapshot($date) failed: ${e.message}", e)
            null
        }
    }

    // ─── Provenance ───────────────────────────────────────────────────────────

    /**
     * Key under which the last successful sync time is kept, so a jump can be
     * read against how long the device had been silent.
     *
     * Stored in the widget prefs, which every native sync path already opens.
     * The server cannot derive this: it only sees the syncs that arrived, so a
     * phone that was offline for three days and one that simply had nothing new
     * to report look identical from that side.
     */
    private const val PREF_LAST_SYNC_AT = "lastSuccessfulSyncAt"
    private const val WIDGET_PREFS = "StepsWidgetPrefs"

    /**
     * The `stepSource` block: which app on the phone counted these steps, when
     * they were recorded, and how they were deduplicated.
     *
     * Diagnostic only — the server records it and never lets it influence the
     * stored total, validation, or coins — so it is built on a best-effort basis
     * and never allowed to fail a sync.
     *
     * `contributed` is sent next to `steps` for every origin because the two
     * differ in the case that generates most step complaints: an origin reported
     * 12,000 and contributed 0 means its steps were seen and deliberately not
     * double-counted, which is a completely different answer from never having
     * seen them.
     */
    private fun buildStepSource(
        dedup: StepOriginDedup.Result,
        records: List<StepOriginDedup.Record>,
        hourly: IntArray,
        offlineMinutes: Long?,
    ): JSONObject {
        val origins = org.json.JSONArray()

        // The primary origin has no Contribution row of its own — it IS the
        // dedup baseline, so everything it reported was counted. Emitting it
        // from the contributions list alone would record the origin that
        // supplied most of the day's steps as having contributed none of them.
        val primaryTotal = records
            .filter { it.origin == dedup.primaryOrigin }
            .sumOf { it.count.coerceAtLeast(0) }
        if (dedup.primaryOrigin.isNotEmpty()) {
            origins.put(JSONObject().apply {
                put("packageName", dedup.primaryOrigin)
                put("steps", primaryTotal)
                put("contributed", primaryTotal)
                put("disjointFraction", 1.0)
            })
        }
        for (c in dedup.contributions) {
            origins.put(JSONObject().apply {
                put("packageName", c.packageName)
                put("steps", c.steps)
                put("contributed", c.contributed)
                put("disjointFraction", c.disjointFraction)
            })
        }

        val hourlyJson = org.json.JSONArray()
        for (h in hourly) hourlyJson.put(h)

        return JSONObject().apply {
            put("reader", "health_connect")
            put("method", if (dedup.contributions.isEmpty()) "single-origin" else "coverage-dedup")
            put("primaryOrigin", dedup.primaryOrigin)
            put("origins", origins)
            put("hourly", hourlyJson)
            put("recordCount", records.size)
            // The span the underlying records actually cover — the field that
            // separates "walked across the whole day, synced once" from "17,000
            // steps stamped inside a single fifteen-minute record".
            records.minByOrNull { it.start }?.let {
                put("recordedFrom", Instant.ofEpochMilli(it.start).toString())
            }
            records.maxByOrNull { it.end }?.let {
                put("recordedTo", Instant.ofEpochMilli(it.end).toString())
            }
            offlineMinutes?.let { put("offlineMinutes", it) }
        }
    }

    /**
     * Minutes since this device last synced successfully, or null when it has no
     * record of ever having done so.
     *
     * Null rather than 0: a fresh install genuinely does not know, and reporting
     * 0 would claim the device had just synced — turning the one field that
     * explains a first-sync backlog into a reason to distrust it.
     */
    private fun offlineMinutes(context: android.content.Context?): Long? {
        if (context == null) return null
        val last = context.getSharedPreferences(WIDGET_PREFS, android.content.Context.MODE_PRIVATE)
            .getLong(PREF_LAST_SYNC_AT, 0L)
        if (last <= 0L) return null
        val minutes = (System.currentTimeMillis() - last) / 60_000L
        return if (minutes >= 0) minutes else null
    }

    // ─── POST /health/sync ────────────────────────────────────────────────────

    /**
     * @param context needed for the X-App-* identity headers and for acting on
     *                a step-tracking rejection. Nullable so the existing
     *                two-argument callers keep compiling; they simply post
     *                without headers, which the server tolerates.
     */
    @JvmOverloads
    fun postSync(token: String, body: JSONObject, context: android.content.Context? = null): Boolean {
        return try {
            val conn = (URL("${BASE_URL}health/sync").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                doOutput       = true
                connectTimeout = 15_000
                readTimeout    = 15_000
            }
            // Identify the build behind this sync. This worker runs every 15
            // minutes with the app closed, so without these headers the bulk of
            // a user's step data would arrive with no version attached at all.
            context?.let { DeviceHeaders.apply(conn, it, "worker") }

            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            // Read the error body BEFORE disconnect() — the stream is closed with
            // the connection.
            val errorBody = if (code !in 200..299) StepTrackingGate.readErrorBody(conn) else null
            conn.disconnect()
            Log.d(TAG, "POST /health/sync [${body.optString("date")}] → HTTP $code")

            if (context != null && errorBody != null) {
                StepTrackingGate.handleSyncResponse(context, code, errorBody)
            }

            val ok = code in 200..299
            // Records that the device reached the server, which is what the next
            // run's `offlineMinutes` measures against. Written on success only:
            // a failed POST is precisely the silence the field exists to report.
            if (ok && context != null) {
                context.getSharedPreferences(WIDGET_PREFS, android.content.Context.MODE_PRIVATE)
                    .edit()
                    .putLong(PREF_LAST_SYNC_AT, System.currentTimeMillis())
                    .apply()
            }
            ok
        } catch (e: Exception) {
            Log.e(TAG, "POST /health/sync failed: ${e.message}", e)
            false
        }
    }
}
