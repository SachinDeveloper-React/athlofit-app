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

        // Don't resurrect the service after logout.
        //
        // The token is read through SecureTokenStore because that is where it lives.
        // Reading `StepsWidgetPrefs.accessToken` directly (as this did) always
        // returned null once SecureTokenStore.saveToken() migrated the token to the
        // encrypted store and deleted the legacy key — so this worker treated every
        // logged-in user as logged out and never restarted the service. The keepalive
        // was therefore dead on exactly the aggressive-OEM devices it exists for,
        // which is a direct cause of "steps stopped counting mid-day".
        val widgetPrefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        if (widgetPrefs.getBoolean("loggedOut", false) ||
            SecureTokenStore.getToken(context).isBlank()
        ) {
            Log.d(TAG, "User logged out — skipping keepalive restart")
            return Result.success()
        }

        // Only restart if hardware sensor available and permission granted
        if (StepSourceResolver.resolve(context) != StepSourceResolver.Source.NATIVE_SENSOR) {
            return Result.success()
        }
        if (StepPermissionManager.needsPermission() && !StepPermissionManager.isGranted(context)) {
            return Result.success()
        }

        if (!isServiceAlive(context)) {
            Log.d(TAG, "StepCounterService not running — restarting")
            // Android 12+ blocks background foreground-service starts, so this can
            // legitimately fail. StepCounterService.start() reports that instead of
            // throwing; the app also retries on every foreground resume.
            val started = StepCounterService.start(context)
            if (!started) {
                Log.w(TAG, "Keepalive restart refused by platform (app in background)")
            }
        }

        return Result.success()
    }

    /**
     * Liveness check for StepCounterService.
     *
     * The in-process `liveStepCount` static is only trustworthy as a positive
     * signal — it is reset when the process dies, but if the system kills only the
     * service the process (and this worker) can keep running with a stale value.
     * The service therefore writes a heartbeat timestamp every 60s; a heartbeat
     * older than HEARTBEAT_STALE_MS means it is gone.
     */
    private fun isServiceAlive(context: Context): Boolean {
        if (StepCounterService.liveStepCount < 0) return false

        val prefs = context.getSharedPreferences(STEP_PREFS_NAME, Context.MODE_PRIVATE)
        val heartbeat = prefs.getLong(StepCounterService.HEARTBEAT_KEY, 0L)
        if (heartbeat <= 0L) return false

        val age = System.currentTimeMillis() - heartbeat
        if (age > StepCounterService.HEARTBEAT_STALE_MS) {
            Log.w(TAG, "Heartbeat stale by ${age / 1000}s — treating service as dead")
            return false
        }
        return true
    }

    companion object {
        private const val TAG = "StepServiceRestart"
        private const val WIDGET_PREFS_NAME = "StepsWidgetPrefs"
        private const val STEP_PREFS_NAME = "StepCounterPrefs"
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
