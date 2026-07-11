package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Auto-starts the step counter service after device boot/restart, similar to how
 * Samsung Health, Google Health, and OEM fitness apps (JOVI, Mi Fitness) auto-start.
 *
 * Also reschedules widget background update jobs and EOD sync.
 *
 * The step counter only starts if:
 * 1. The user is logged in (accessToken present and not marked as logged out)
 * 2. The device has a hardware step sensor
 * 3. ACTIVITY_RECOGNITION permission is granted (user has completed setup before)
 *
 * Handles boot intents from stock Android, HTC, Vivo/iQOO, Xiaomi, and other OEMs.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
        private const val WIDGET_PREFS_NAME = "StepsWidgetPrefs"

        // All boot-related actions we handle
        private val BOOT_ACTIONS = setOf(
            Intent.ACTION_BOOT_COMPLETED,                    // Standard Android
            "android.intent.action.QUICKBOOT_POWERON",       // HTC / some OEMs
            "com.htc.intent.action.QUICKBOOT_POWERON",       // HTC specific
            Intent.ACTION_MY_PACKAGE_REPLACED,               // App updated
        )
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        if (action !in BOOT_ACTIONS) return

        Log.d(TAG, "Received action: $action — checking conditions to start service")

        // Always reschedule background jobs (widget updates, EOD sync)
        WidgetScheduler.schedule(context)
        EodSyncScheduler.schedule(context)

        // Check if user is logged in before starting the step counter service
        if (!isUserLoggedIn(context)) {
            Log.d(TAG, "User not logged in — skipping StepCounterService auto-start")
            return
        }

        // Check hardware sensor availability and permission
        if (StepSourceResolver.resolve(context) != StepSourceResolver.Source.NATIVE_SENSOR) {
            Log.d(TAG, "Native step sensor not available — skipping StepCounterService")
            return
        }

        if (StepPermissionManager.needsPermission() && !StepPermissionManager.isGranted(context)) {
            Log.d(TAG, "ACTIVITY_RECOGNITION permission not granted — skipping StepCounterService")
            return
        }

        // All conditions met — start the service
        Log.d(TAG, "User logged in + sensor available + permission granted — starting StepCounterService")
        StepCounterService.start(context)
        StepServiceScheduler.schedule(context)
    }

    /**
     * Checks if the user is logged in by verifying:
     * 1. The "loggedOut" flag is NOT set to true
     * 2. An accessToken exists in SharedPreferences
     *
     * This mirrors the same check used by WidgetUpdateWorker and EodSyncWorker.
     */
    private fun isUserLoggedIn(context: Context): Boolean {
        val prefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val isLoggedOut = prefs.getBoolean("loggedOut", false)
        if (isLoggedOut) return false

        val accessToken = prefs.getString("accessToken", null)
        return !accessToken.isNullOrBlank()
    }
}
