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
    }

    override suspend fun doWork(): Result {
        return try {
            Log.d(TAG, "Starting background widget update")

            val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
            val goal = prefs.getInt("goal", 10000)

            // Read steps from Health Connect natively (no app needed)
            val steps = readStepsFromHealthConnect()

            Log.d(TAG, "Background read: $steps steps, goal: $goal")

            // Update widget with fresh data
            StepsWidgetProvider.updateWidget(context, steps, goal)

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Widget update failed: ${e.message}", e)
            // Retry on failure (up to WorkManager's default retry limit)
            Result.retry()
        }
    }

    private suspend fun readStepsFromHealthConnect(): Int {
        return try {
            val client = HealthConnectClient.getOrCreate(context)

            // Read steps for today only (midnight → now)
            val today = LocalDate.now()
            val startOfDay = today.atStartOfDay(ZoneId.systemDefault()).toInstant()
            val now = java.time.Instant.now()

            // Respect login timestamp if set — don't count steps before login
            val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
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

            Log.d(TAG, "Health Connect returned $totalSteps steps (since ${effectiveStart})")
            totalSteps
        } catch (e: Exception) {
            Log.w(TAG, "Could not read Health Connect: ${e.message}")
            // Fall back to last known value from prefs
            val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
            prefs.getInt("steps", 0)
        }
    }
}
