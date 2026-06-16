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
        val loginTs   = prefs.getLong("loginTimestamp", 0L)
        val zone      = ZoneId.systemDefault()
        val today     = LocalDate.now()

        // Determine the earliest date to sync — the login date or 7 days ago, whichever is later.
        val loginDate = if (loginTs > 0L) {
            Instant.ofEpochMilli(loginTs).atZone(zone).toLocalDate()
        } else {
            today
        }
        val sevenDaysAgo = today.minusDays(6) // today + 6 previous days = 7 days
        val startDate = if (loginDate.isAfter(sevenDaysAgo)) loginDate else sevenDaysAgo

        var anySuccess = false

        // Sync each day from startDate to today
        var current = startDate
        while (!current.isAfter(today)) {
            // For the login date, pass loginTs so steps start from login time.
            // For all other days, use 0L (full day from midnight).
            val tsForDay = if (current == loginDate && loginTs > 0L) loginTs else 0L
            val dayData = readDaySnapshot(client, current, zone, weightKg, tsForDay)
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
    ): JSONObject? {
        return try {
            val startOfDay = date.atStartOfDay(zone).toInstant()
            val endOfDay   = date.plusDays(1).atStartOfDay(zone).toInstant().minusMillis(1)
            val isToday    = date == LocalDate.now(zone)
            val endTime    = if (isToday) Instant.now() else endOfDay

            // Apply login filter only on the first login day
            val stepsStart = if (loginTs > 0L) {
                val loginInstant = Instant.ofEpochMilli(loginTs)
                if (loginInstant.isAfter(startOfDay) && loginInstant.isBefore(endTime))
                    loginInstant else startOfDay
            } else startOfDay

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

            val stepsByOrigin = stepRecords
                .groupBy { it.metadata.dataOrigin.packageName }
                .mapValues { (_, records) -> records.sumOf { it.count } }

            val steps = stepsByOrigin.values.maxOrNull()?.toInt() ?: 0
            Log.d(TAG, "[$date] Steps by origin: $stepsByOrigin → using $steps")

            // ── Derive calories / distance / activeMinutes from steps ──────────
            val calories      = (steps * (weightKg * 0.57) / 1000).toInt()
            val distanceKm    = Math.round(steps * (0.76 / 1000) * 100.0) / 100.0
            val activeMinutes = steps / 100

            // ── Heart rate ────────────────────────────────────────────────────
            val bpms = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, fullFilter))
                .records.flatMap { it.samples }.map { it.beatsPerMinute }
            val heartRate    = if (bpms.isNotEmpty()) (bpms.sum() / bpms.size).toInt() else 0
            val heartRateMin = bpms.minOrNull()?.toInt() ?: 0
            val heartRateMax = bpms.maxOrNull()?.toInt() ?: 0

            // ── Blood pressure ────────────────────────────────────────────────
            val latestBp = client.readRecords(ReadRecordsRequest(BloodPressureRecord::class, recentFilter))
                .records.lastOrNull()
            val systolic  = latestBp?.systolic?.inMillimetersOfMercury?.toInt() ?: 0
            val diastolic = latestBp?.diastolic?.inMillimetersOfMercury?.toInt() ?: 0

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
