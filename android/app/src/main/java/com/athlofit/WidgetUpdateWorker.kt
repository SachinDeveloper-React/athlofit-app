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
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        return@withContext try {
            Log.d(TAG, "Worker started")

            if (StepsWidgetProvider.isAppInitialising(context)) {
                Log.d(TAG, "App is initialising — skipping")
                return@withContext Result.success()
            }

            // If the user is logged out, skip the update to preserve the logged-out UI
            if (prefs.getBoolean("loggedOut", false)) {
                Log.d(TAG, "User is logged out — skipping widget update")
                return@withContext Result.success()
            }

            val goal  = prefs.getInt("goal", StepsWidgetProvider.DEFAULT_DAILY_STEP_GOAL)
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
        // Use max(liveSteps, displayStepFloor) so the widget always shows at least
        // what the app UI displays (which includes server baseline + HC offset).
        //
        // liveStepCount is only trustworthy while the service is actually alive. It
        // is a static in the app process, so when the system kills just the service
        // and leaves the process running it keeps its last value — the same trap
        // StepServiceRestartWorker.isServiceAlive() documents. Reading it unchecked
        // meant a dead service's stale total could be rendered AND stamped with a
        // fresh lastUpdated, turning a stale value into an apparently current one.
        val liveSteps = StepCounterService.liveStepCount
        val displayFloor = StepCounterService.displayStepFloor
        val heartbeat = stepPrefs.getLong(StepCounterService.HEARTBEAT_KEY, 0L)
        val heartbeatFresh = heartbeat > 0L &&
            (System.currentTimeMillis() - heartbeat) <= StepCounterService.HEARTBEAT_STALE_MS
        if (liveSteps >= 0 && heartbeatFresh) {
            val displaySteps = maxOf(liveSteps, displayFloor)
            Log.d(TAG, "Using live sensor steps: $liveSteps (floor=$displayFloor, display=$displaySteps)")
            return displaySteps
        }
        if (liveSteps >= 0) {
            Log.d(TAG, "Ignoring liveStepCount=$liveSteps — heartbeat stale (age=${if (heartbeat > 0) (System.currentTimeMillis() - heartbeat) / 1000 else -1}s)")
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

            // Clamped like every other Health Connect reader in the app
            // (HealthSyncHelper, StepCounterService's HC poll, the JS reader). This
            // was the one path with no upper bound, so an absurd total written by
            // some other app on the device landed on the widget unfiltered.
            val steps = (stepsByOrigin.values.maxOrNull() ?: 0L)
                .coerceIn(0L, MAX_SANE_DAILY_STEPS.toLong())
                .toInt()
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
