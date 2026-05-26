package com.athlofit

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * WidgetUpdateWorker
 *
 * Runs every 15 minutes via WorkManager — even when the app is fully closed.
 *
 * Steps are read via aggregate() — the Health Connect API designed for
 * cumulative data. It automatically deduplicates overlapping records from
 * multiple sources (Sweatcoin, Strava, etc.) and uses the most authoritative
 * source (the device's native step counter). Works on every Android OEM
 * without any package-name allowlist.
 */
class WidgetUpdateWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "WidgetUpdateWorker"
        private const val PREF_APP_INITIALISING = "appInitialising"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        return@withContext try {
            Log.d(TAG, "Worker started")

            if (prefs.getBoolean(PREF_APP_INITIALISING, false)) {
                Log.d(TAG, "App is initialising — skipping")
                return@withContext Result.success()
            }

            val goal  = prefs.getInt("goal", 10000)
            val token = prefs.getString("accessToken", null)

            val todaySteps = readTodaySteps(prefs)
            StepsWidgetProvider.updateWidget(context, todaySteps, goal)
            Log.d(TAG, "Widget updated: $todaySteps steps / $goal goal")

            if (!token.isNullOrBlank()) {
                HealthSyncHelper.syncTodayAndYesterday(context, prefs, token)
            } else {
                Log.d(TAG, "No token — skipping API sync")
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Worker failed: ${e.message}", e)
            Result.failure()
        }
    }

    private suspend fun readTodaySteps(prefs: android.content.SharedPreferences): Int {
        return try {
            val client     = HealthConnectClient.getOrCreate(context)
            val today      = LocalDate.now()
            val zone       = ZoneId.systemDefault()
            val startOfDay = today.atStartOfDay(zone).toInstant()
            val now        = Instant.now()

            val loginTs = prefs.getLong("loginTimestamp", 0L)
            val stepsStart = if (loginTs > 0L) {
                val loginInstant = Instant.ofEpochMilli(loginTs)
                if (loginInstant.isAfter(startOfDay)) loginInstant else startOfDay
            } else startOfDay

            // readRecords + single-source dedup — same logic as HealthSyncHelper.
            // aggregate() sums steps from ALL origins (Sweatcoin, Google Fit, etc.)
            // causing inflation. We pick the single highest-count source instead.
            val stepRecords = client.readRecords(
                ReadRecordsRequest(StepsRecord::class, TimeRangeFilter.between(stepsStart, now))
            ).records

            val stepsByOrigin = stepRecords
                .groupBy { it.metadata.dataOrigin.packageName }
                .mapValues { (_, records) -> records.sumOf { it.count } }

            val steps = stepsByOrigin.values.maxOrNull()?.toInt() ?: 0
            Log.d(TAG, "Steps by origin: $stepsByOrigin → using $steps")
            steps
        } catch (e: Exception) {
            Log.w(TAG, "Steps read failed: ${e.message}")
            prefs.getInt("steps", 0)
        }
    }
}
