package com.athlofit

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object WidgetScheduler {

    private const val TAG = "WidgetScheduler"
    private const val WORK_NAME = "StepsWidgetAutoUpdate"

    /**
     * Schedule periodic widget updates every 15 minutes (Android minimum).
     * Uses KEEP policy — won't reschedule if already running.
     * Call this on:
     *   - Widget added to home screen (onEnabled)
     *   - App launch / login
     *   - Device reboot (via BootReceiver)
     */
    fun schedule(context: Context) {
        Log.d(TAG, "Scheduling periodic widget updates (every 15 min)")

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED) // works offline
            .setRequiresBatteryNotLow(false)                  // run even on low battery
            .build()

        val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(
            15, TimeUnit.MINUTES   // Android minimum interval
        )
            .setConstraints(constraints)
            .addTag(WORK_NAME)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,  // don't reset timer if already scheduled
            request
        )

        Log.d(TAG, "Widget update work scheduled")
    }

    /**
     * Cancel all scheduled widget updates.
     * Call this on logout or when widget is removed.
     */
    fun cancel(context: Context) {
        Log.d(TAG, "Cancelling widget update work")
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }

    /**
     * Force an immediate one-shot update right now (in addition to periodic).
     * Call this when the app comes to foreground or user taps refresh.
     */
    fun runNow(context: Context) {
        Log.d(TAG, "Running immediate widget update")

        val request = androidx.work.OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
            .addTag("${WORK_NAME}_immediate")
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }
}
