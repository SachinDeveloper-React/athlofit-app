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
 * Syncs TWO records per run:
 *
 *  1. TODAY  — steps counted from max(loginTimestamp, startOfDay) → now
 *              This respects the login time so a user who logged in at 2 PM
 *              only sees steps from 2 PM onward on their first day.
 *              On subsequent days loginTimestamp < startOfDay so the full
 *              day (00:00 → now) is used automatically.
 *
 *  2. YESTERDAY — full day 00:00 → 23:59:59 (no login filter)
 *                 Ensures yesterday's complete data is always committed even
 *                 if the app was closed all day.
 *
 * Each POST includes an explicit `date` field (YYYY-MM-DD) so the backend
 * upserts the correct day's record regardless of when the worker runs.
 */
object HealthSyncHelper {

    private const val TAG = "HealthSyncHelper"
    private const val BASE_URL = "https://athlofit-backend.vercel.app/"

    // ─── Public entry point ───────────────────────────────────────────────────

    /**
     * Read today's and yesterday's health data from Health Connect and POST
     * both to /health/sync. Returns true if at least one sync succeeded.
     *
     * @param context  Android Context
     * @param prefs    StepsWidgetPrefs — contains loginTimestamp, weightKg, accessToken
     * @param token    Bearer token for the API
     */
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

        // ── 1. Sync TODAY ─────────────────────────────────────────────────────
        val todayData = readDaySnapshot(
            client   = client,
            date     = today,
            zone     = zone,
            weightKg = weightKg,
            loginTs  = loginTs,   // apply login filter for today only
        )
        if (todayData != null && todayData.optInt("steps") > 0) {
            val ok = postSync(token, todayData)
            Log.d(TAG, "TODAY sync ${if (ok) "OK" else "FAIL"} — ${todayData.optInt("steps")} steps")
            if (ok) anySuccess = true
        }

        // ── 2. Sync YESTERDAY ─────────────────────────────────────────────────
        val yesterdayData = readDaySnapshot(
            client   = client,
            date     = yesterday,
            zone     = zone,
            weightKg = weightKg,
            loginTs  = 0L,        // no login filter — always full day
        )
        if (yesterdayData != null && yesterdayData.optInt("steps") > 0) {
            val ok = postSync(token, yesterdayData)
            Log.d(TAG, "YESTERDAY sync ${if (ok) "OK" else "FAIL"} — ${yesterdayData.optInt("steps")} steps")
            if (ok) anySuccess = true
        }

        return anySuccess
    }

    // ─── Read a single day's health snapshot ──────────────────────────────────

    /**
     * Reads all health metrics for [date] from Health Connect.
     *
     * @param loginTs  If > 0 AND loginTs > startOfDay, steps are counted only
     *                 from loginTs onward (first-login-day filter).
     *                 Pass 0 to always use the full day (00:00 → end of day).
     */
    private suspend fun readDaySnapshot(
        client:   HealthConnectClient,
        date:     LocalDate,
        zone:     ZoneId,
        weightKg: Double,
        loginTs:  Long,
    ): JSONObject? {
        return try {
            val startOfDay = date.atStartOfDay(zone).toInstant()
            // End of day: 23:59:59.999 — use start of next day minus 1 ms
            val endOfDay   = date.plusDays(1).atStartOfDay(zone).toInstant()
                .minusMillis(1)
            // For today we cap at "now" so we don't query the future
            val isToday    = date == LocalDate.now(zone)
            val endTime    = if (isToday) Instant.now() else endOfDay

            // Apply login filter only when loginTs falls within today's window
            val stepsStart = if (loginTs > 0L) {
                val loginInstant = Instant.ofEpochMilli(loginTs)
                if (loginInstant.isAfter(startOfDay) && loginInstant.isBefore(endTime))
                    loginInstant
                else
                    startOfDay
            } else {
                startOfDay
            }

            val fullFilter  = TimeRangeFilter.between(startOfDay, endTime)
            val stepsFilter = TimeRangeFilter.between(stepsStart, endTime)
            // For vitals that span overnight (sleep, BP) use a 48-h window
            val recentFilter = TimeRangeFilter.between(
                date.minusDays(1).atStartOfDay(zone).toInstant(), endTime
            )
            val monthFilter = TimeRangeFilter.between(
                date.minusDays(30).atStartOfDay(zone).toInstant(), endTime
            )

            // ── Steps ─────────────────────────────────────────────────────────
            val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, stepsFilter))
                .records.sumOf { it.count }.toInt()

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
            val latestBp  = client.readRecords(ReadRecordsRequest(BloodPressureRecord::class, recentFilter))
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

            // ── ISO date string for this day (YYYY-MM-DD) ─────────────────────
            val dateStr = date.toString() // LocalDate.toString() = "YYYY-MM-DD"

            JSONObject().apply {
                put("date",                   dateStr)   // ← explicit date for backend upsert
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
                put("goalMet",                false) // server recalculates
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
