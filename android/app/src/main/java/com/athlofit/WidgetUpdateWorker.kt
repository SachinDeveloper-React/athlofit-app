package com.athlofit

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.LocalDate
import java.time.ZoneId

class WidgetUpdateWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "WidgetUpdateWorker"

        // SharedPrefs key that the JS side writes when the app is actively
        // initialising Health Connect. We skip the HC read while this flag is
        // set to avoid a concurrent-access crash during app startup.
        private const val PREF_APP_INITIALISING = "appInitialising"
    }

    override suspend fun doWork(): Result {
        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        return try {
            Log.d(TAG, "Starting background widget update")

            // If the app is currently starting up and initialising Health Connect,
            // skip this run entirely (don't retry — the periodic job will fire again
            // in 15 min, and the app will push a fresh update via updateWidget() once
            // it finishes loading).
            if (prefs.getBoolean(PREF_APP_INITIALISING, false)) {
                Log.d(TAG, "App is initialising — skipping HC read to avoid concurrent access crash")
                return Result.success()
            }

            val goal = prefs.getInt("goal", 10000)

            // Read steps from Health Connect natively (no app needed)
            val steps = readStepsFromHealthConnect(prefs)

            Log.d(TAG, "Background read: $steps steps, goal: $goal")

            // Update widget with fresh data
            StepsWidgetProvider.updateWidget(context, steps, goal)

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Widget update failed: ${e.message}", e)
            // Use failure (not retry) so a crash during app startup doesn't
            // cause an infinite retry loop that keeps crashing the app on reopen.
            Result.failure()
        }
    }

    private suspend fun readStepsFromHealthConnect(
        prefs: android.content.SharedPreferences
    ): Int {
        return try {
            val client = HealthConnectClient.getOrCreate(context)

            // Read steps for today only (midnight → now)
            val today = LocalDate.now()
            val startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant()
            val now = java.time.Instant.now()

            // Respect login timestamp if set — don't count steps before login
            val loginTs = prefs.getLong("loginTimestamp", 0L)
            val effectiveStart = if (loginTs > 0L) {
                val loginInstant = java.time.Instant.ofEpochMilli(loginTs)
                // Use the later of: login time OR start of today
                if (loginInstant.isAfter(startOfDay)) loginInstant else startOfDay
            } else {
                startOfDay
            }

            val request = ReadRecordsRequest(
                recordType = StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(effectiveStart, now)
            )

            val response = client.readRecords(request)
            val totalSteps = response.records.sumOf { it.count }.toInt()

            Log.d(TAG, "Health Connect returned $totalSteps steps (since $effectiveStart)")
            totalSteps
        } catch (e: Exception) {
            Log.w(TAG, "Could not read Health Connect: ${e.message}")
            // Fall back to last known value from prefs
            prefs.getInt("steps", 0)
        }
    }
}
