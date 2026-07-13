package com.athlofit

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import java.util.Calendar

/**
 * MidnightAlarmScheduler
 *
 * Centralized utility for scheduling the midnight reset alarm.
 * Uses setExactAndAllowWhileIdle for precise timing on Android 12+,
 * falling back to setAndAllowWhileIdle on devices where exact alarm
 * permission is not granted.
 *
 * Can be called from:
 * - StepCounterService (after each midnight reset)
 * - BootReceiver (after device boot/app update)
 * - MidnightResetReceiver (after the alarm fires, to reschedule next day)
 */
object MidnightAlarmScheduler {

    private const val TAG = "MidnightAlarmScheduler"
    private const val MIDNIGHT_ALARM_REQUEST_CODE = 3001

    /**
     * Schedules the next midnight alarm at 00:00:01 local time tomorrow.
     * If an existing alarm is already scheduled, it is replaced (FLAG_UPDATE_CURRENT).
     */
    fun schedule(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager is null — cannot schedule midnight alarm")
            return
        }

        val intent = Intent(context, MidnightResetReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            MIDNIGHT_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Target 00:00:01 tomorrow to ensure the date has fully changed
        val calendar = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 1)
            set(Calendar.MILLISECOND, 0)
        }

        // Use exact alarm if permitted (more reliable on OEM-aggressive devices)
        val canUseExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true // Pre-S, exact alarms don't require special permission
        }

        if (canUseExact) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                pendingIntent
            )
            Log.d(TAG, "Exact midnight alarm scheduled for ${calendar.time}")
        } else {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                calendar.timeInMillis,
                pendingIntent
            )
            Log.w(TAG, "Exact alarm not permitted — using inexact alarm for ${calendar.time}")
        }
    }

    /**
     * Cancels any pending midnight alarm.
     * Call on logout to stop unnecessary alarms.
     */
    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, MidnightResetReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            MIDNIGHT_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(pendingIntent)
        Log.d(TAG, "Midnight alarm cancelled")
    }
}
