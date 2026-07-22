package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * MidnightResetReceiver
 *
 * BroadcastReceiver triggered by AlarmManager at midnight (00:00:00) as a
 * fallback reset trigger for the step counter.
 *
 * Behavior:
 * - If StepCounterService is not running: starts it, which triggers handleDateChangeOnStart()
 *   to detect the date change and perform the midnight reset.
 * - If StepCounterService is already running: starts it with an EXTRA_MIDNIGHT_RESET intent
 *   extra, causing onStartCommand to call performMidnightReset directly.
 *
 * After firing, reschedules the next midnight alarm via MidnightAlarmScheduler
 * to ensure the alarm chain is never broken (even if the service fails to start).
 */
class MidnightResetReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MidnightResetReceiver"
        const val EXTRA_MIDNIGHT_RESET = "com.athlofit.athlofit.EXTRA_MIDNIGHT_RESET"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "Midnight alarm received — starting StepCounterService with midnight reset extra")

        // Immediately reset the widget to 0 steps. This ensures the widget shows
        // "0 steps" at midnight even if the service fails to start (OEM restriction).
        // The service will update it with the correct count once it starts.
        val widgetPrefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
        val goal = widgetPrefs.getInt("goal", 10000)
        StepsWidgetProvider.updateWidget(context, 0, goal)

        // Also reset the notification step count in SharedPreferences so the
        // notification shows 0 when the service restarts.
        val stepPrefs = context.getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE)
        val today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
        val storedDate = stepPrefs.getString("storedDate", "") ?: ""
        if (storedDate.isNotEmpty() && storedDate != today) {
            // Read lastCumulative so we can set baseline correctly.
            // baseline = lastCumulative ensures the next sensor event calculates
            // (cumulative - baseline) = 0 + new steps, not yesterday's total.
            val lastCumulative = stepPrefs.getLong("lastCumulative", 0L)
            val newBaseline = if (lastCumulative > 0L) lastCumulative else stepPrefs.getLong("baseline", 0L)
            stepPrefs.edit()
                .putInt("dailySteps", 0)
                .putInt("rebootOffset", 0)
                .putLong("baseline", newBaseline)
                .putString("storedDate", today)
                .apply()
            Log.d(TAG, "Reset StepCounterPrefs for new day: $storedDate → $today, baseline=$newBaseline, lastCum=$lastCumulative")
        }

        val serviceIntent = Intent(context, StepCounterService::class.java).apply {
            putExtra(EXTRA_MIDNIGHT_RESET, true)
        }

        try {
            context.startForegroundService(serviceIntent)
        } catch (e: Exception) {
            // On some OEMs (Xiaomi MIUI, Huawei EMUI), starting a foreground service
            // from a BroadcastReceiver can throw if the app is in a restricted state.
            // The widget is already reset above. The service will detect the day
            // change on the next sensor event or when the user opens the app.
            Log.e(TAG, "Failed to start StepCounterService from midnight alarm: ${e.message}", e)
        }

        // Always reschedule the next midnight alarm as a safety net.
        // Normally the service also reschedules in performMidnightReset(), but if the
        // service failed to start above, this ensures the alarm chain isn't broken.
        MidnightAlarmScheduler.schedule(context)
    }
}
