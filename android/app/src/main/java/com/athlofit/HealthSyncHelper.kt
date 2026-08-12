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
            val dayData = readDaySnapshot(client, current, zone, weightKg, tsForDay, context.packageName)
            if (dayData != null && dayData.optInt("steps") > 0) {
                val ok = postSync(token, dayData)
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

            // ── Steps via readRecords() + single-source dedup ─────────────────
            // aggregate() sums steps from ALL data origins — including third-party
            // apps like Sweatcoin, Google Fit, Samsung Health that also write
            // StepsRecord. This inflates the count vs the native step counter.
            //
            // Fix: read individual records, group by dataOrigin, and keep only
            // the single source with the highest total. This matches what the
            // native step counter app shows (one authoritative source).
            val stepRecords = client.readRecords(
                ReadRecordsRequest(StepsRecord::class, stepsFilter)
            ).records

            // Self-exclusion uses the runtime package name, not a hardcoded literal.
            // The literal only matched the production applicationId, so on any variant
            // with a suffix (.debug, .staging) our own records were treated as an
            // external data source and could win the max() below — the app reading its
            // own output back, which is the loop this filter exists to break.
            val stepsByOrigin = stepRecords
                .groupBy { it.metadata.dataOrigin.packageName }
                .filterKeys { it != ownPackage }
                .mapValues { (_, records) -> records.sumOf { it.count } }

            // Clamped like every other reader. This value is POSTed straight to the
            // server, so an absurd total written by some other app on the device would
            // otherwise reach the backend with only server-side validation in the way.
            val steps = (stepsByOrigin.values.maxOrNull() ?: 0L)
                .coerceIn(0L, MAX_SANE_DAILY_STEPS.toLong())
                .toInt()
            Log.d(TAG, "[$date] Steps by origin (excluding $ownPackage): $stepsByOrigin → using $steps")

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
                put("goalMet",                false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "readDaySnapshot($date) failed: ${e.message}", e)
            null
        }
    }

    // ─── POST /health/sync ────────────────────────────────────────────────────

    fun postSync(token: String, body: JSONObject): Boolean {
        return try {
            val conn = (URL("${BASE_URL}health/sync").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $token")
                doOutput       = true
                connectTimeout = 15_000
                readTimeout    = 15_000
            }
            conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            conn.disconnect()
            Log.d(TAG, "POST /health/sync [${body.optString("date")}] → HTTP $code")
            code in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "POST /health/sync failed: ${e.message}", e)
            false
        }
    }
}
