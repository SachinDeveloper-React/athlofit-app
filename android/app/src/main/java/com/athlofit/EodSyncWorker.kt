package com.athlofit

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant

/**
 * EodSyncWorker
 *
 * One-shot CoroutineWorker triggered at 23:59:50 every night by EodSyncScheduler.
 *
 * Syncs TWO records before midnight:
 *  - TODAY    — steps from loginTimestamp (or midnight) → now
 *  - YESTERDAY — full day 00:00 → 23:59:59 (no login filter)
 *
 * This guarantees the day's final step count is committed to the database
 * before the date rolls over, even when the app is fully closed.
 */
class EodSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "EodSyncWorker"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        Log.d(TAG, "EOD sync started at ${Instant.now()}")

        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        if (prefs.getBoolean("appInitialising", false)) {
            Log.d(TAG, "App is initialising — skipping EOD sync")
            return@withContext Result.success()
        }

        val token = prefs.getString("accessToken", null)
        if (token.isNullOrBlank()) {
            Log.d(TAG, "No access token — skipping EOD sync")
            return@withContext Result.success()
        }

        return@withContext try {
            val ok = HealthSyncHelper.syncTodayAndYesterday(context, prefs, token)
            Log.d(TAG, "EOD sync ${if (ok) "succeeded" else "had no data to sync"}")
            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "EOD sync error: ${e.message}", e)
            Result.success() // don't retry — alarm fires again tomorrow
        }
    }
}
