package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

/**
 * Receives the AlarmManager broadcast fired by [WidgetScheduler.runNow].
 * Immediately enqueues a one-shot [WidgetUpdateWorker] so the widget
 * refreshes within seconds rather than waiting for WorkManager's queue.
 */
class WidgetAlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.d("WidgetAlarmReceiver", "Alarm fired — enqueuing immediate widget update")

        val request = OneTimeWorkRequestBuilder<WidgetUpdateWorker>()
            .addTag("StepsWidgetAutoUpdate_alarm")
            .build()

        WorkManager.getInstance(context).enqueue(request)
    }
}
