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
 * EodSyncWorker
 *
 * One-shot CoroutineWorker triggered at 23:59:50 by EodSyncScheduler.
 * Reads today's full health snapshot from Health Connect and POSTs it to
 * /health/sync so the day's final data is committed before midnight.
 */
class EodSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "EodSyncWorker"
        private const val BASE_URL = "https://athlofit-backend.vercel.app/"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "EOD sync started at ${Instant.now()}")

        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        if (prefs.getBoolean("appInitialising", false)) {
            Log.d(TAG, "App is initialising — skipping EOD sync")
            return@withContext Result.success()
        }

        val token = getAccessToken()
        if (token.isNullOrBlank()) {
            Log.d(TAG, "No access token — skipping EOD sync")
            return@withContext Result.success()
        }

        return@withContext try {
            val healthData = readHealthConnectData(prefs)
            if (healthData == null) {
                Log.w(TAG, "Could not read Health Connect data")
                return@withContext Result.success()
            }

            val synced = postHealthSync(token, healthData)
            Log.d(TAG, "EOD sync ${if (synced) "succeeded" else "failed"} — ${healthData.optInt("steps")} steps")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "EOD sync error: ${e.message}", e)
            Result.success() // don't retry — alarm fires again tomorrow
        }
    }

    private fun getAccessToken(): String? = try {
        context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
            .getString("accessToken", null)
    } catch (e: Exception) {
        Log.w(TAG, "Could not read access token: ${e.message}")
        null
    }

    private suspend fun readHealthConnectData(
        prefs: android.content.SharedPreferences
    ): JSONObject? {
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

            JSONObject().apply {
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
            Log.e(TAG, "Health Connect read failed: ${e.message}", e)
            null
        }
    }

    private fun postHealthSync(token: String, body: JSONObject): Boolean {
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
            Log.d(TAG, "POST /health/sync → HTTP $code")
            code in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "POST /health/sync failed: ${e.message}", e)
            false
        }
    }
}
