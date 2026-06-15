package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * MidnightResetReceiver
 *
 * BroadcastReceiver triggered by AlarmManager at midnight as a fallback reset trigger.
 *
 * Behavior:
 * - If StepCounterService is not running: starts it, which triggers handleDateChangeOnStart()
 *   to detect the date change and perform the midnight reset.
 * - If StepCounterService is already running: starts it with an EXTRA_MIDNIGHT_RESET intent
 *   extra, causing onStartCommand to call performMidnightReset directly.
 *
 * In both cases, calling startForegroundService invokes onStartCommand which handles
 * the reset appropriately based on the intent extra.
 */
class MidnightResetReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MidnightResetReceiver"
        const val EXTRA_MIDNIGHT_RESET = "com.athlofit.athlofit.EXTRA_MIDNIGHT_RESET"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "Midnight alarm received — starting StepCounterService with midnight reset extra")
        // Start the service with the midnight reset extra.
        // If the service is not running, onStartCommand will call handleDateChangeOnStart()
        // which detects the date change and performs the reset.
        // If the service is already running, onStartCommand will see the extra and call
        // performMidnightReset() directly for an immediate reset.
        val serviceIntent = Intent(context, StepCounterService::class.java).apply {
            putExtra(EXTRA_MIDNIGHT_RESET, true)
        }
        context.startForegroundService(serviceIntent)
    }
}
