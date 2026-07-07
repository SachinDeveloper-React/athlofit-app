package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Reschedules the widget background update job after device reboot and auto-starts
 * the step counter service so the notification appears without opening the app.
 *
 * The step counter only starts if:
 * 1. The device has a hardware step sensor
 * 2. ACTIVITY_RECOGNITION permission is granted (user has completed setup before)
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            Log.d("BootReceiver", "Device booted — rescheduling widget updates and EOD sync")
            WidgetScheduler.schedule(context)
            EodSyncScheduler.schedule(context)

            // Start native step counter service — it manages its own foreground
            // notification with live step count updates on every sensor event.
            // Only start if permission was previously granted (user completed setup).
            if (StepSourceResolver.resolve(context) == StepSourceResolver.Source.NATIVE_SENSOR &&
                (!StepPermissionManager.needsPermission() || StepPermissionManager.isGranted(context))
            ) {
                Log.d("BootReceiver", "Native sensor + permission granted — starting StepCounterService")
                StepCounterService.start(context)
                StepServiceScheduler.schedule(context)
            } else {
                Log.d("BootReceiver", "Sensor unavailable or permission not granted — skipping StepCounterService")
            }
        }
    }
}
