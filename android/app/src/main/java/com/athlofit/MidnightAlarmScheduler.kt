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
 *
 * Uses a dual-alarm strategy for maximum reliability:
 *   1. setAlarmClock() — NEVER deferred by Doze (treated as user-facing alarm).
 *      Guaranteed delivery even on aggressive OEMs. Minor downside: shows a
 *      small alarm icon in the status bar.
 *   2. setExactAndAllowWhileIdle() — backup alarm without the status bar icon.
 *      Fires in most cases but can be deferred by Doze on some OEMs.
 *
 * Why setAlarmClock() works when others don't:
 *   - Android framework whitelists AlarmClock alarms from Doze and App Standby
 *   - OEMs (Xiaomi, Huawei, Samsung) don't restrict AlarmClock because it's
 *     used by the system clock/alarm app and users expect it to always fire
 *   - It wakes the device from deep sleep unconditionally
 *
 * Can be called from:
 * - StepCounterService (after each midnight reset)
 * - BootReceiver (after device boot/app update)
 * - MidnightResetReceiver (after the alarm fires, to reschedule next day)
 * - MidnightResetWorker (after performing a missed reset)
 */
object MidnightAlarmScheduler {

    private const val TAG = "MidnightAlarmScheduler"
    private const val MIDNIGHT_ALARM_REQUEST_CODE = 3001
    private const val MIDNIGHT_CLOCK_REQUEST_CODE = 3002

    /**
     * Schedules the next midnight alarm at exactly 00:00:00 local time tomorrow.
     * If an existing alarm is already scheduled, it is replaced (FLAG_UPDATE_CURRENT).
     *
     * Registers both a setAlarmClock (Doze-proof) and a setExactAndAllowWhileIdle
     * (standard exact alarm) for redundancy.
     */
    fun schedule(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager is null — cannot schedule midnight alarm")
            return
        }

        // Target exactly 00:00:00 tomorrow for instant reset at midnight
        val calendar = Calendar.getInstance().apply {
            add(Calendar.DAY_OF_YEAR, 1)
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        val triggerAtMillis = calendar.timeInMillis

        // ── Primary: setAlarmClock (Doze-proof, guaranteed delivery) ─────────
        scheduleAlarmClock(context, alarmManager, triggerAtMillis)

        // ── Backup: setExactAndAllowWhileIdle (no status bar icon) ───────────
        scheduleExactAlarm(context, alarmManager, triggerAtMillis)
    }

    /**
     * Schedules a setAlarmClock alarm — the most reliable alarm type on Android.
     * Android NEVER defers this alarm type, even in Doze mode, because it's
     * designed for user-facing alarms (clock app, medication reminders, etc.).
     *
     * The "show intent" opens the app when the user taps the alarm icon in the
     * status bar — this is a minor side effect but acceptable for a fitness app.
     */
    private fun scheduleAlarmClock(context: Context, alarmManager: AlarmManager, triggerAtMillis: Long) {
        try {
            val intent = Intent(context, MidnightResetReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                MIDNIGHT_CLOCK_REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            // "Show intent" — opens the app if user taps the alarm icon in status bar
            val showIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val showPendingIntent = if (showIntent != null) {
                PendingIntent.getActivity(
                    context, 0, showIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            } else {
                pendingIntent // Fallback to same broadcast
            }

            val alarmClockInfo = AlarmManager.AlarmClockInfo(triggerAtMillis, showPendingIntent)
            alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            Log.d(TAG, "AlarmClock (Doze-proof) scheduled for ${calendar(triggerAtMillis)}")
        } catch (e: Exception) {
            // Some extremely restricted OEMs may throw here — log and rely on backup
            Log.w(TAG, "setAlarmClock failed: ${e.message} — relying on exact alarm backup")
        }
    }

    /**
     * Schedules a setExactAndAllowWhileIdle alarm as a backup.
     * Falls back to setAndAllowWhileIdle if exact alarm permission is not granted (API 31+).
     */
    private fun scheduleExactAlarm(context: Context, alarmManager: AlarmManager, triggerAtMillis: Long) {
        val intent = Intent(context, MidnightResetReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            MIDNIGHT_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val canUseExact = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true // Pre-S, exact alarms don't require special permission
        }

        if (canUseExact) {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
            Log.d(TAG, "Exact backup alarm scheduled for ${calendar(triggerAtMillis)}")
        } else {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent
            )
            Log.w(TAG, "Exact alarm not permitted — inexact backup alarm for ${calendar(triggerAtMillis)}")
        }
    }

    /**
     * Cancels all pending midnight alarms (both AlarmClock and exact).
     * Call on logout to stop unnecessary alarms.
     */
    fun cancel(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val intent = Intent(context, MidnightResetReceiver::class.java)

        // Cancel exact alarm
        val exactPendingIntent = PendingIntent.getBroadcast(
            context,
            MIDNIGHT_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(exactPendingIntent)

        // Cancel AlarmClock alarm
        val clockPendingIntent = PendingIntent.getBroadcast(
            context,
            MIDNIGHT_CLOCK_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.cancel(clockPendingIntent)

        Log.d(TAG, "All midnight alarms cancelled")
    }

    /** Helper to format millis as a readable date for logging. */
    private fun calendar(millis: Long): String {
        val cal = Calendar.getInstance().apply { timeInMillis = millis }
        return cal.time.toString()
    }
}
