package com.athlofit

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.concurrent.TimeUnit

/**
 * MidnightResetWorker
 *
 * Periodic WorkManager job that runs every hour to verify the step counter
 * has been reset for the new day. This acts as a reliable backup for the
 * AlarmManager midnight alarm, which can be missed due to:
 *   - Doze mode deferring alarms
 *   - OEM battery restrictions killing BroadcastReceivers
 *   - App standby buckets throttling exact alarms
 *
 * WorkManager is backed by Google Play Services (GMS) on most devices,
 * making it significantly more resilient to OEM process killing than
 * standalone AlarmManager alarms.
 *
 * Behavior:
 *   1. Reads `storedDate` from StepCounterPrefs
 *   2. If storedDate != today → midnight reset was missed
 *   3. Resets SharedPreferences (dailySteps=0, rebootOffset=0, baseline=lastCumulative)
 *   4. Updates notification and widget to show 0
 *   5. Attempts to start StepCounterService with midnight reset flag
 */
class MidnightResetWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        private const val TAG = "MidnightResetWorker"
        private const val UNIQUE_WORK_NAME = "midnight_reset_check"

        /**
         * Enqueues the periodic midnight reset check.
         * Safe to call multiple times — KEEP policy ensures only one instance runs.
         */
        fun enqueue(context: Context) {
            val request = PeriodicWorkRequestBuilder<MidnightResetWorker>(
                1, TimeUnit.HOURS
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                UNIQUE_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
            Log.d(TAG, "Periodic midnight reset check enqueued (every 1 hour)")
        }
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        try {
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val stepPrefs = context.getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE)
            val storedDate = stepPrefs.getString("storedDate", "") ?: ""

            // If storedDate already matches today, midnight reset has already happened
            if (storedDate.isEmpty() || storedDate == today) {
                Log.d(TAG, "No reset needed (storedDate=$storedDate, today=$today)")
                return@withContext Result.success()
            }

            // ── Midnight reset was missed! Perform it now. ───────────────────
            Log.w(TAG, "Midnight reset missed! storedDate=$storedDate, today=$today — resetting now")

            val lastCumulative = stepPrefs.getLong("lastCumulative", 0L)
            val newBaseline = if (lastCumulative > 0L) lastCumulative else 0L

            stepPrefs.edit()
                .putInt("dailySteps", 0)
                .putInt("rebootOffset", 0)
                .putLong("baseline", newBaseline)
                .putString("storedDate", today)
                .apply()

            StepCounterService.debugLog(context, "WORKER_RESET: $storedDate → $today, baseline=$newBaseline")

            // Reset the widget to 0 immediately
            val widgetPrefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
            val goal = widgetPrefs.getInt("goal", 10000)
            StepsWidgetProvider.updateWidget(context, 0, goal)

            // Try to start StepCounterService with midnight reset flag so it
            // can perform the full reset (emit events to JS, update notification, etc.)
            try {
                val serviceIntent = Intent(context, StepCounterService::class.java).apply {
                    putExtra(MidnightResetReceiver.EXTRA_MIDNIGHT_RESET, true)
                }
                context.startForegroundService(serviceIntent)
                Log.d(TAG, "StepCounterService started with midnight reset flag")
            } catch (e: Exception) {
                // OEM restriction — service can't start. SharedPrefs and widget are
                // already reset. The notification will show 0 via buildStepNotification's
                // date guard the next time it updates.
                Log.w(TAG, "Could not start StepCounterService: ${e.message}")
            }

            // Reschedule the midnight alarm as a safety net
            MidnightAlarmScheduler.schedule(context)

            return@withContext Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "MidnightResetWorker failed: ${e.message}", e)
            return@withContext Result.retry()
        }
    }
}
