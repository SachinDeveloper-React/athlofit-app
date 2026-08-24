package com.athlofit

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
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
    private const val ALARM_REQUEST_CODE = 9001

    /**
     * Schedule periodic widget updates every 15 minutes (Android minimum).
     * Uses UPDATE policy — resets the timer on each call so drift doesn't accumulate.
     * Call this on:
     *   - Widget added to home screen (onEnabled)
     *   - App launch / login
     *   - Device reboot (via BootReceiver)
     */
    fun schedule(context: Context) {
        // Nothing to schedule while step tracking is paused for this account —
        // the worker's only job is to read steps and POST them. Guarded here
        // rather than at each of the six call sites (boot, login, widget added,
        // …) so no path can quietly re-arm it.
        if (!StepTrackingGate.isEnabled(context)) {
            Log.d(TAG, "Not scheduling widget updates — step tracking disabled")
            return
        }

        Log.d(TAG, "Scheduling periodic widget updates (every 15 min)")

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED) // HC read works offline; API call handles its own failure
            .setRequiresBatteryNotLow(false)
            .build()

        val request = PeriodicWorkRequestBuilder<WidgetUpdateWorker>(
            15, TimeUnit.MINUTES,   // Android minimum interval
            5, TimeUnit.MINUTES     // flex: run in the last 5 min of each window
        )
            .setConstraints(constraints)
            .addTag(WORK_NAME)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,  // reset timer on reschedule so drift doesn't accumulate
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
        cancelAlarm(context)
    }

    /**
     * Force an immediate one-shot update using AlarmManager so it fires in
     * seconds rather than going through WorkManager's queue (which can be
     * deferred by minutes on battery-optimised devices).
     *
     * Falls back to a WorkManager one-shot if exact alarms are not permitted.
     */
    fun runNow(context: Context) {
        Log.d(TAG, "Running immediate widget update")

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, WidgetAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val triggerAt = System.currentTimeMillis() + 500L // fire in ~500 ms

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                // Exact alarms not permitted — fall back to inexact (still faster than WorkManager)
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
                Log.d(TAG, "Exact alarms not permitted — using inexact alarm")
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
                Log.d(TAG, "Exact alarm scheduled for immediate update")
            }
        } catch (e: Exception) {
            Log.w(TAG, "AlarmManager failed, falling back to WorkManager: ${e.message}")
            val request = androidx.work.OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
                .addTag("${WORK_NAME}_immediate")
                .build()
            WorkManager.getInstance(context).enqueue(request)
        }
    }

    private fun cancelAlarm(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, WidgetAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        pendingIntent?.let { alarmManager.cancel(it) }
    }
}
