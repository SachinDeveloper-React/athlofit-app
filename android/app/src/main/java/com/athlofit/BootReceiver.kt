package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Reschedules the widget background update job after device reboot.
 * WorkManager periodic work does NOT survive reboots automatically on all
 * Android versions, so we re-enqueue it here.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            Log.d("BootReceiver", "Device booted — rescheduling widget updates and EOD sync")
            WidgetScheduler.schedule(context)
            EodSyncScheduler.schedule(context)
            // Restart the live step-count foreground notification
            StepNotificationService.start(context)
        }
    }
}
