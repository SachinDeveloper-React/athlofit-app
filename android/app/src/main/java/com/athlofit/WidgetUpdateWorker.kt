package com.athlofit

import android.content.Context
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
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * WidgetUpdateWorker
 *
 * Runs every 15 minutes via WorkManager — even when the app is fully closed
 * or in the recent apps tray.
 *
 * Does two things in one pass:
 *  1. Reads today's steps from Health Connect → updates the home-screen widget
 *  2. Reads the full health snapshot → POSTs to /health/sync so the database
 *     always has up-to-date data even when the app is not open
 *
 * Calories, distance, and activeMinutes are DERIVED from steps (same formula
 * as healthConnect.service.ts) rather than read from Health Connect, because
 * those records may not exist if writeDerivedActivity hasn't run yet.
 */
class WidgetUpdateWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "WidgetUpdateWorker"
        private const val BASE_URL = "https://athlofit-backend.vercel.app/"
        private const val PREF_APP_INITIALISING = "appInitialising"
    }

    private data class HealthSnapshot(
        val steps: Int,
        val calories: Int,
        val distanceKm: Double,
        val activeMinutes: Int,
        val heartRate: Int,
        val heartRateMin: Int,
        val heartRateMax: Int,
        val systolic: Int,
        val diastolic: Int,
        val sleepHours: Double,
        val weight: Double,
        val bloodGlucose: Double,
        val hydrationMl: Int,
    )

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        return@withContext try {
            Log.d(TAG, "Starting background widget + sync update")

            if (prefs.getBoolean(PREF_APP_INITIALISING, false)) {
                Log.d(TAG, "App is initialising — skipping HC read")
                return@withContext Result.success()
            }

            val goal  = prefs.getInt("goal", 10000)
            val token = prefs.getString("accessToken", null)

            val snapshot = readHealthSnapshot(prefs)

            // 1. Update widget (always — no network needed)
            StepsWidgetProvider.updateWidget(context, snapshot.steps, goal)
            Log.d(TAG, "Widget updated: ${snapshot.steps} steps / $goal goal")

            // 2. Sync to backend (only if logged in and have steps)
            if (!token.isNullOrBlank() && snapshot.steps > 0) {
                val ok = postHealthSync(token, snapshot)
                Log.d(TAG, "API sync ${if (ok) "succeeded" else "failed"}: ${snapshot.steps} steps")
            } else {
                Log.d(TAG, "Skipping API sync — token=${!token.isNullOrBlank()}, steps=${snapshot.steps}")
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Worker failed: ${e.message}", e)
            Result.failure()
        }
    }

    private suspend fun readHealthSnapshot(
        prefs: android.content.SharedPreferences
    ): HealthSnapshot {
        return try {
            val client     = HealthConnectClient.getOrCreate(context)
            val today      = LocalDate.now()
            val startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant()
            val now        = Instant.now()

            // Respect login timestamp — only count steps since login
            val loginTs = prefs.getLong("loginTimestamp", 0L)
            val stepsStart = if (loginTs > 0L) {
                val loginInstant = Instant.ofEpochMilli(loginTs)
                if (loginInstant.isAfter(startOfDay)) loginInstant else startOfDay
            } else startOfDay

            val todayFilter  = TimeRangeFilter.between(startOfDay, now)
            val stepsFilter  = TimeRangeFilter.between(stepsStart, now)
            val recentFilter = TimeRangeFilter.between(
                today.minusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant(), now
            )
            val monthFilter  = TimeRangeFilter.between(
                today.minusDays(30).atStartOfDay(ZoneId.systemDefault()).toInstant(), now
            )

            // ── Steps ─────────────────────────────────────────────────────────
            val steps = client.readRecords(ReadRecordsRequest(StepsRecord::class, stepsFilter))
                .records.sumOf { it.count }.toInt()

            // ── Derive calories / distance / activeMinutes from steps ──────────
            // Mirrors healthConnect.service.ts — never read these from HC
            // because they may not exist if writeDerivedActivity hasn't run yet.
            val weightKg      = prefs.getFloat("weightKg", 70.0f).toDouble()
            val calories      = (steps * (weightKg * 0.57) / 1000).toInt()
            val distanceKm    = Math.round(steps * (0.76 / 1000) * 100.0) / 100.0
            val activeMinutes = steps / 100

            // ── Heart rate ────────────────────────────────────────────────────
            val bpms = client.readRecords(ReadRecordsRequest(HeartRateRecord::class, todayFilter))
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
            val hydrationMl = client.readRecords(ReadRecordsRequest(HydrationRecord::class, todayFilter))
                .records.sumOf { it.volume.inLiters * 1000.0 }.toInt()

            HealthSnapshot(
                steps         = steps,
                calories      = calories,
                distanceKm    = distanceKm,
                activeMinutes = activeMinutes,
                heartRate     = heartRate,
                heartRateMin  = heartRateMin,
                heartRateMax  = heartRateMax,
                systolic      = systolic,
                diastolic     = diastolic,
                sleepHours    = sleepHours,
                weight        = weight,
                bloodGlucose  = bloodGlucose,
                hydrationMl   = hydrationMl,
            )
        } catch (e: Exception) {
            Log.w(TAG, "Health Connect read failed: ${e.message}")
            // Fall back to last known steps for the widget; zeros for everything else
            HealthSnapshot(
                steps = prefs.getInt("steps", 0),
                calories = 0, distanceKm = 0.0, activeMinutes = 0,
                heartRate = 0, heartRateMin = 0, heartRateMax = 0,
                systolic = 0, diastolic = 0, sleepHours = 0.0,
                weight = 0.0, bloodGlucose = 0.0, hydrationMl = 0,
            )
        }
    }

    private fun postHealthSync(token: String, s: HealthSnapshot): Boolean {
        return try {
            val body = JSONObject().apply {
                put("steps",                  s.steps)
                put("calories",               s.calories)
                put("distance",               s.distanceKm)
                put("activeMinutes",          s.activeMinutes)
                put("heartRate",              s.heartRate)
                put("heartRateMin",           s.heartRateMin)
                put("heartRateMax",           s.heartRateMax)
                put("bloodPressureSystolic",  s.systolic)
                put("bloodPressureDiastolic", s.diastolic)
                put("sleepHours",             s.sleepHours)
                put("weight",                 s.weight)
                put("bloodGlucose",           s.bloodGlucose)
                put("hydration",              s.hydrationMl)
                put("goalMet",                false) // server recalculates
            }

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
            Log.d(TAG, "POST /health/sync → HTTP $code")
            code in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "POST /health/sync failed: ${e.message}", e)
            false
        }
    }
}
