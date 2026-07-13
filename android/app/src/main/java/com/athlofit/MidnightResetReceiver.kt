package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * MidnightResetReceiver
 *
 * BroadcastReceiver triggered by AlarmManager at midnight (00:00:01) as a
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

        val serviceIntent = Intent(context, StepCounterService::class.java).apply {
            putExtra(EXTRA_MIDNIGHT_RESET, true)
        }

        try {
            context.startForegroundService(serviceIntent)
        } catch (e: Exception) {
            // On some OEMs (Xiaomi MIUI, Huawei EMUI), starting a foreground service
            // from a BroadcastReceiver can throw if the app is in a restricted state.
            // The service will detect the day change on the next sensor event via
            // onSensorChanged's date check, or when the user opens the app.
            Log.e(TAG, "Failed to start StepCounterService from midnight alarm: ${e.message}", e)
        }

        // Always reschedule the next midnight alarm as a safety net.
        // Normally the service also reschedules in performMidnightReset(), but if the
        // service failed to start above, this ensures the alarm chain isn't broken.
        MidnightAlarmScheduler.schedule(context)
    }
}
