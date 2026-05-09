package com.athlofit

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/**
 * EodSyncScheduler
 *
 * Schedules an exact AlarmManager alarm at 23:59:50 every night.
 * When it fires, EodSyncReceiver enqueues EodSyncWorker which reads
 * Health Connect and POSTs the day's data to /health/sync.
 *
 * Uses setExactAndAllowWhileIdle so it fires even in Doze mode.
 * Falls back to setAndAllowWhileIdle on devices where exact alarms
 * are not permitted (Android 12+ without SCHEDULE_EXACT_ALARM).
 */
object EodSyncScheduler {

    private const val TAG = "EodSyncScheduler"
    private const val REQUEST_CODE = 9002

    /**
     * Schedule (or re-schedule) the 23:59:50 alarm.
     * Safe to call multiple times — cancels the previous alarm first.
     * Call this on login and after each alarm fires (in EodSyncReceiver).
     */
    fun schedule(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pendingIntent = buildPendingIntent(context) ?: return

        // Cancel any existing alarm first
        alarmManager.cancel(pendingIntent)

        val triggerAt = nextEodAlarmMillis()
        Log.d(TAG, "Scheduling EOD sync alarm for ${java.util.Date(triggerAt)}")

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                !alarmManager.canScheduleExactAlarms()
            ) {
                // Exact alarms not permitted — use inexact but wake-up variant
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAt,
                    pendingIntent
                )
                Log.d(TAG, "Exact alarms not permitted — using setAndAllowWhileIdle")
            } else {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAt,
                    pendingIntent
                )
                Log.d(TAG, "Exact EOD alarm set for ${java.util.Date(triggerAt)}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule EOD alarm: ${e.message}", e)
        }
    }

    /**
     * Cancel the EOD alarm.
     * Call this on logout.
     */
    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pendingIntent = buildPendingIntent(context) ?: return
        alarmManager.cancel(pendingIntent)
        Log.d(TAG, "EOD sync alarm cancelled")
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Returns the next 23:59:50 in millis. If already past today's, returns tomorrow's. */
    private fun nextEodAlarmMillis(): Long {
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 23)
            set(Calendar.MINUTE, 59)
            set(Calendar.SECOND, 50)
            set(Calendar.MILLISECOND, 0)
        }
        if (cal.timeInMillis <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_YEAR, 1)
        }
        return cal.timeInMillis
    }

    private fun buildPendingIntent(context: Context): PendingIntent? {
        return try {
            val intent = Intent(context, EodSyncReceiver::class.java)
            PendingIntent.getBroadcast(
                context,
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } catch (e: Exception) {
            Log.e(TAG, "Could not build PendingIntent: ${e.message}")
            null
        }
    }
}
