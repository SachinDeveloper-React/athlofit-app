package com.athlofit

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

/**
 * EodSyncReceiver
 *
 * Receives the AlarmManager broadcast fired by EodSyncScheduler at 23:59:50.
 * Immediately enqueues a one-shot EodSyncWorker so the health data is synced
 * to the backend before midnight, even when the app is fully closed.
 */
class EodSyncReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        Log.d("EodSyncReceiver", "EOD alarm fired — enqueuing EodSyncWorker")

        val request = OneTimeWorkRequestBuilder<EodSyncWorker>()
            .addTag("EodHealthSync_alarm")
            .build()

        WorkManager.getInstance(context).enqueue(request)

        // Re-schedule for the same time tomorrow
        EodSyncScheduler.schedule(context)
    }
}
