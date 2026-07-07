package com.athlofit

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Ensures StepCounterService stays alive on aggressive OEMs (Samsung, Xiaomi, Huawei)
 * that kill foreground services despite START_STICKY.
 *
 * Runs every 15 minutes via WorkManager. If the service is not running
 * (liveStepCount == -1) and permission is granted, restarts it.
 */
class StepServiceRestartWorker(
    context: Context,
    params: WorkerParameters
) : Worker(context, params) {

    override fun doWork(): Result {
        val context = applicationContext

        // Only restart if hardware sensor available and permission granted
        if (StepSourceResolver.resolve(context) != StepSourceResolver.Source.NATIVE_SENSOR) {
            return Result.success()
        }
        if (StepPermissionManager.needsPermission() && !StepPermissionManager.isGranted(context)) {
            return Result.success()
        }

        // Check if service is running (liveStepCount >= 0 means it's active)
        if (StepCounterService.liveStepCount < 0) {
            Log.d(TAG, "StepCounterService not running — restarting")
            StepCounterService.start(context)
        }

        return Result.success()
    }

    companion object {
        private const val TAG = "StepServiceRestart"
    }
}

/**
 * Schedules the periodic StepServiceRestartWorker.
 * Call from BootReceiver and when the user grants ACTIVITY_RECOGNITION permission.
 */
object StepServiceScheduler {

    private const val TAG = "StepServiceScheduler"
    private const val WORK_NAME = "step_service_keepalive"

    fun schedule(context: Context) {
        Log.d(TAG, "Scheduling StepServiceRestartWorker (every 15 min)")

        val request = PeriodicWorkRequestBuilder<StepServiceRestartWorker>(
            15, TimeUnit.MINUTES,
            5, TimeUnit.MINUTES  // flex window
        )
            .setConstraints(
                Constraints.Builder()
                    .setRequiresBatteryNotLow(false) // restart even on low battery
                    .build()
            )
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP, // don't reset if already scheduled
            request
        )
    }

    fun cancel(context: Context) {
        Log.d(TAG, "Cancelling StepServiceRestartWorker")
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }
}
