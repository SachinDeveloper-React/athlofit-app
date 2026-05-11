package com.athlofit

import android.content.Context
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * WidgetUpdateWorker
 *
 * Runs every 15 minutes via WorkManager — even when the app is fully closed
 * or in the recent apps tray.
 *
 * Per run it:
 *  1. Reads today's steps → updates the home-screen widget
 *  2. Syncs TODAY's health data (steps from loginTimestamp or midnight → now)
 *  3. Syncs YESTERDAY's health data (full day 00:00 → 23:59:59, no login filter)
 *
 * Both syncs include an explicit `date` field so the backend upserts the
 * correct day's record regardless of when the worker fires.
 */
class WidgetUpdateWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "WidgetUpdateWorker"
        private const val PREF_APP_INITIALISING = "appInitialising"
    }

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val prefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)

        return@withContext try {
            Log.d(TAG, "Worker started")

            if (prefs.getBoolean(PREF_APP_INITIALISING, false)) {
                Log.d(TAG, "App is initialising — skipping")
                return@withContext Result.success()
            }

            val goal  = prefs.getInt("goal", 10000)
            val token = prefs.getString("accessToken", null)

            // ── 1. Update widget with today's steps (fast, no API needed) ─────
            val todaySteps = readTodaySteps(prefs)
            StepsWidgetProvider.updateWidget(context, todaySteps, goal)
            Log.d(TAG, "Widget updated: $todaySteps steps / $goal goal")

            // ── 2 & 3. Sync today + yesterday to backend ──────────────────────
            if (!token.isNullOrBlank()) {
                HealthSyncHelper.syncTodayAndYesterday(context, prefs, token)
            } else {
                Log.d(TAG, "No token — skipping API sync")
            }

            Result.success()
        } catch (e: Exception) {
            Log.e(TAG, "Worker failed: ${e.message}", e)
            Result.failure()
        }
    }

    // ─── Read today's steps only (for widget display) ─────────────────────────
    // Lightweight — only reads Steps, no other metrics.

    private suspend fun readTodaySteps(prefs: android.content.SharedPreferences): Int {
        return try {
            val client     = HealthConnectClient.getOrCreate(context)
            val today      = LocalDate.now()
            val zone       = ZoneId.systemDefault()
            val startOfDay = today.atStartOfDay(zone).toInstant()
            val now        = Instant.now()

            val loginTs = prefs.getLong("loginTimestamp", 0L)
            val stepsStart = if (loginTs > 0L) {
                val loginInstant = Instant.ofEpochMilli(loginTs)
                if (loginInstant.isAfter(startOfDay)) loginInstant else startOfDay
            } else startOfDay

            client.readRecords(
                ReadRecordsRequest(StepsRecord::class, TimeRangeFilter.between(stepsStart, now))
            ).records.sumOf { it.count }.toInt()
        } catch (e: Exception) {
            Log.w(TAG, "Steps read failed: ${e.message}")
            prefs.getInt("steps", 0) // fall back to last known value
        }
    }
}
