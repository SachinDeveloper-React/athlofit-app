package com.athlofit

import android.content.SharedPreferences
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
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
    private const val BASE_URL = "https://athlofit-backend.vercel.app/"

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
        val yesterday = today.minusDays(1)

        var anySuccess = false

        val todayData = readDaySnapshot(client, today, zone, weightKg, loginTs)
        if (todayData != null && todayData.optInt("steps") > 0) {
            val ok = postSync(token, todayData)
            Log.d(TAG, "TODAY sync ${if (ok) "OK" else "FAIL"} — ${todayData.optInt("steps")} steps")
            if (ok) anySuccess = true
        }

        val yesterdayData = readDaySnapshot(client, yesterday, zone, weightKg, loginTs = 0L)
        if (yesterdayData != null && yesterdayData.optInt("steps") > 0) {
            val ok = postSync(token, yesterdayData)
            Log.d(TAG, "YESTERDAY sync ${if (ok) "OK" else "FAIL"} — ${yesterdayData.optInt("steps")} steps")
            if (ok) anySuccess = true
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

            // ── Steps via aggregate() ─────────────────────────────────────────
            // aggregate() is the correct API for cumulative data. It:
            //  • Deduplicates overlapping records from multiple apps automatically
            //  • Uses the most authoritative source (native step counter)
            //  • Works on every Android OEM without any package-name allowlist
            val stepsResult: AggregationResult = client.aggregate(
                AggregateRequest(
                    metrics      = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = stepsFilter,
                )
            )
            val steps = stepsResult[StepsRecord.COUNT_TOTAL]?.toInt() ?: 0
            Log.d(TAG, "[$date] Steps (aggregate): $steps")

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
