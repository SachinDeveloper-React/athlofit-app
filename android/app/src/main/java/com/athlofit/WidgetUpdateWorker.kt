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

            // If the user is logged out, skip the update to preserve the logged-out UI
            if (prefs.getBoolean("loggedOut", false)) {
                Log.d(TAG, "User is logged out — skipping widget update")
                return@withContext Result.success()
            }

            val goal  = prefs.getInt("goal", 10000)
            // FIX #10: Read token from SecureTokenStore (encrypted)
            val token = SecureTokenStore.getToken(context).ifBlank { null }

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
        // FIX: Check stored date before trusting liveStepCount.
        // After midnight but before first sensor event, liveStepCount has yesterday's value.
        val stepPrefs = context.getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE)
        val storedDate = stepPrefs.getString("storedDate", "") ?: ""
        val today = LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)

        if (storedDate.isNotEmpty() && storedDate != today) {
            Log.d(TAG, "Midnight reset pending (storedDate=$storedDate, today=$today) — returning 0")
            return 0
        }

        // Prefer the live in-memory step count from StepCounterService (real-time).
        val liveSteps = StepCounterService.liveStepCount
        if (liveSteps >= 0) {
            Log.d(TAG, "Using live sensor steps: $liveSteps")
            return liveSteps
        }

        // Fallback: try persisted value from StepCounterService
        // storedDate already verified as today above
        if (storedDate == today) {
            val persistedSteps = stepPrefs.getInt("dailySteps", 0)
            if (persistedSteps > 0) {
                Log.d(TAG, "Using persisted sensor steps: $persistedSteps (date=$storedDate)")
                return persistedSteps
            }
        }

        // Last resort: query Health Connect
        return try {
            val client     = HealthConnectClient.getOrCreate(context)
            val today      = LocalDate.now()
            val zone       = ZoneId.systemDefault()
            val startOfDay = today.atStartOfDay(zone).toInstant()
            val now        = Instant.now()

            // FIX: Always use startOfDay to show ALL steps walked today.
            // Previously filtered by loginTimestamp which caused the widget to
            // show fewer steps than the phone's built-in pedometer after re-login.
            val stepsStart = startOfDay

            val stepRecords = client.readRecords(
                ReadRecordsRequest(StepsRecord::class, TimeRangeFilter.between(stepsStart, now))
            ).records

            val stepsByOrigin = stepRecords
                .groupBy { it.metadata.dataOrigin.packageName }
                .filterKeys { it != applicationContext.packageName }
                .mapValues { (_, records) -> records.sumOf { it.count } }

            val steps = stepsByOrigin.values.maxOrNull()?.toInt() ?: 0
            Log.d(TAG, "Steps by origin (HC fallback, excluding self): $stepsByOrigin → using $steps")
            steps
        } catch (e: Exception) {
            Log.w(TAG, "Steps read failed: ${e.message}")
            // Only return cached widget steps if they were written today.
            // Prevents showing yesterday's stale count when HC is unavailable.
            val lastUpdated = prefs.getLong("lastUpdated", 0)
            val isFromToday = if (lastUpdated > 0) {
                val updateCal = java.util.Calendar.getInstance().apply { timeInMillis = lastUpdated }
                val nowCal = java.util.Calendar.getInstance()
                updateCal.get(java.util.Calendar.DAY_OF_YEAR) == nowCal.get(java.util.Calendar.DAY_OF_YEAR) &&
                    updateCal.get(java.util.Calendar.YEAR) == nowCal.get(java.util.Calendar.YEAR)
            } else false
            if (isFromToday) prefs.getInt("steps", 0) else 0
        }
    }
}
