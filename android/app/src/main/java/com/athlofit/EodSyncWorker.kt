package com.athlofit

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.HydrationRecord
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
 * A one-shot CoroutineWorker that:
 *  1. Reads today's full health snapshot from Health Connect (steps, calories,
 *     distance, heart rate, sleep, weight, blood pressure, blood glucose, hydration)
 *  2. POSTs it to POST /health/sync with the stored access token
 *
 * Triggered by EodSyncReceiver at 23:59:50 every night via an exact AlarmManager
 * alarm — no JS / React Native context required.
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

        // ── Guard: skip if app is initialising Health Connect ─────────────────
        if (prefs.getBoolean("appInitialising", false)) {
            Log.d(TAG, "App is initialising — skipping EOD sync")
            return@withContext Result.success()
        }

        // ── Guard: skip if no access token ────────────────────────────────────
        val token = getAccessToken()
        if (token.isNullOrBlank()) {
            Log.d(TAG, "No access token — user not logged in, skipping EOD sync")
            return@withContext Result.success()
        }

        return@withContext try {
            val healthData = readHealthConnectData(prefs)
            if (healthData == null) {
                Log.w(TAG, "Could not read Health Connect data")
                return@withContext Result.success()
            }

            val synced = postHealthSync(token, healthData)
            if (synced) {
                Log.d(TAG, "EOD sync succeeded — ${healthData.optInt("steps")} steps saved")
            } else {
                Log.w(TAG, "EOD sync POST failed")
            }
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "EOD sync error: ${e.message}", e)
            // Don't retry — the alarm will fire again tomorrow
            Result.success()
        }
    }

    // ─── Read access token from Keychain via SharedPreferences ────────────────
    // react-native-keychain stores tokens in Android Keystore-backed SharedPrefs.
    // The service name matches tokenService.ts: "com.healthapp.accessToken"
    private fun getAccessToken(): String? {
        return try {
            // react-native-keychain uses a SharedPreferences file named after the service
            val keychainPrefs = context.getSharedPreferences(
                "com.healthapp.accessToken",
                Context.MODE_PRIVATE
            )
            // The password field is stored under the key "password"
            keychainPrefs.getString("password", null)
        } catch (e: Exception) {
            Log.w(TAG, "Could not read access token: ${e.message}")
            null
        }
    }

    // ─── Read full health snapshot from Health Connect ────────────────────────
    private suspend fun readHealthConnectData(
        prefs: android.content.SharedPreferences
    ): JSONObject? {
        return try {
            val client = HealthConnectClient.getOrCreate(context)

            val today = LocalDate.now()
            val startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant()
            val now = Instant.now()

            // Respect login timestamp — don't count steps before login
            val loginTs = prefs.getLong("loginTimestamp", 0L)
            val stepsStart = if (loginTs > 0L) {
                val loginInstant = Instant.ofEpochMilli(loginTs)
                if (loginInstant.isAfter(startOfDay)) loginInstant else startOfDay
            } else {
                startOfDay
            }

            val todayFilter  = TimeRangeFilter.between(startOfDay, now)
            val stepsFilter  = TimeRangeFilter.between(stepsStart, now)
            val weekFilter   = TimeRangeFilter.between(
                today.minusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant(), now
            )

            // ── Steps ─────────────────────────────────────────────────────────
            val stepsResp = client.readRecords(
                ReadRecordsRequest(StepsRecord::class, stepsFilter)
            )
            val steps = stepsResp.records.sumOf { it.count }.toInt()

            // ── Calories ──────────────────────────────────────────────────────
            val calResp = client.readRecords(
                ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, todayFilter)
            )
            val calories = calResp.records.sumOf {
                it.energy.inKilocalories
            }.toInt()

            // ── Distance ──────────────────────────────────────────────────────
            val distResp = client.readRecords(
                ReadRecordsRequest(DistanceRecord::class, todayFilter)
            )
            val distanceKm = distResp.records.sumOf {
                it.distance.inKilometers
            }.let { Math.round(it * 100.0) / 100.0 }

            // ── Heart rate ────────────────────────────────────────────────────
            val hrResp = client.readRecords(
                ReadRecordsRequest(HeartRateRecord::class, todayFilter)
            )
            val allBpms = hrResp.records.flatMap { it.samples }.map { it.beatsPerMinute }
            val heartRate    = if (allBpms.isNotEmpty()) (allBpms.sum() / allBpms.size).toInt() else 0
            val heartRateMin = allBpms.minOrNull()?.toInt() ?: 0
            val heartRateMax = allBpms.maxOrNull()?.toInt() ?: 0

            // ── Blood pressure ────────────────────────────────────────────────
            val bpResp = client.readRecords(
                ReadRecordsRequest(BloodPressureRecord::class, weekFilter)
            )
            val latestBp = bpResp.records.lastOrNull()
            val systolic  = latestBp?.systolic?.inMillimetersOfMercury?.toInt() ?: 0
            val diastolic = latestBp?.diastolic?.inMillimetersOfMercury?.toInt() ?: 0

            // ── Sleep ─────────────────────────────────────────────────────────
            val sleepResp = client.readRecords(
                ReadRecordsRequest(SleepSessionRecord::class, weekFilter)
            )
            val sleepMs = sleepResp.records.sumOf {
                it.endTime.toEpochMilli() - it.startTime.toEpochMilli()
            }
            val sleepHours = Math.round((sleepMs / 3_600_000.0) * 10.0) / 10.0

            // ── Weight ────────────────────────────────────────────────────────
            val weightResp = client.readRecords(
                ReadRecordsRequest(WeightRecord::class,
                    TimeRangeFilter.between(
                        today.minusDays(30).atStartOfDay(ZoneId.systemDefault()).toInstant(), now
                    )
                )
            )
            val weight = weightResp.records.lastOrNull()
                ?.weight?.inKilograms
                ?.let { Math.round(it * 10.0) / 10.0 } ?: 0.0

            // ── Blood glucose ─────────────────────────────────────────────────
            val glucoseResp = client.readRecords(
                ReadRecordsRequest(BloodGlucoseRecord::class, weekFilter)
            )
            val bloodGlucose = glucoseResp.records.lastOrNull()
                ?.level?.inMillimolesPerLiter
                ?.let { Math.round(it * 10.0) / 10.0 } ?: 0.0

            // ── Hydration ─────────────────────────────────────────────────────
            val hydResp = client.readRecords(
                ReadRecordsRequest(HydrationRecord::class, todayFilter)
            )
            val hydrationMl = hydResp.records.sumOf {
                it.volume.inLiters * 1000.0
            }.toInt()

            // ── Derive active minutes from steps ──────────────────────────────
            val activeMinutes = steps / 100

            JSONObject().apply {
                put("steps",                    steps)
                put("calories",                 calories)
                put("distance",                 distanceKm)
                put("activeMinutes",            activeMinutes)
                put("heartRate",                heartRate)
                put("heartRateMin",             heartRateMin)
                put("heartRateMax",             heartRateMax)
                put("bloodPressureSystolic",    systolic)
                put("bloodPressureDiastolic",   diastolic)
                put("sleepHours",               sleepHours)
                put("weight",                   weight)
                put("bloodGlucose",             bloodGlucose)
                put("hydration",                hydrationMl)
                put("goalMet",                  false) // server recalculates
            }
        } catch (e: Exception) {
            Log.e(TAG, "Health Connect read failed: ${e.message}", e)
            null
        }
    }

    // ─── POST /health/sync ────────────────────────────────────────────────────
    private fun postHealthSync(token: String, body: JSONObject): Boolean {
        return try {
            val url = URL("${BASE_URL}health/sync")
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.connectTimeout = 15_000
            conn.readTimeout = 15_000

            conn.outputStream.use { os ->
                os.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            val code = conn.responseCode
            Log.d(TAG, "POST /health/sync → HTTP $code")
            conn.disconnect()
            code in 200..299
        } catch (e: Exception) {
            Log.e(TAG, "POST /health/sync failed: ${e.message}", e)
            false
        }
    }
}
