package com.athlofit

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * StepNotificationService
 *
 * Shows a persistent notification with today's live step count.
 *
 * Step source priority:
 * 1. Native sensor (API < 34): reads StepCounterService.liveStepCount
 *    (in-memory, updated on every sensor event) for real-time accuracy.
 * 2. Health Connect (API >= 34): queries readRecords() with single-source
 *    deduplication — same logic as WidgetUpdateWorker and HealthSyncHelper.
 *
 * Refreshes every 10 seconds via a Handler loop for near-real-time updates.
 */
class StepNotificationService : Service() {

    companion object {
        const val TAG = "StepNotificationService"
        const val CHANNEL_ID = "step_counter_live"
        const val NOTIF_ID = 1001

        private const val REFRESH_INTERVAL_MS = 10_000L  // refresh every 10s for near-real-time steps
        private const val PREFS_NAME = "StepsWidgetPrefs"
        private const val KEY_GOAL   = "goal"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, StepNotificationService::class.java))
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, StepNotificationService::class.java))
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val handler = Handler(Looper.getMainLooper())
    private var lastSteps = -1

    private val refreshRunnable = object : Runnable {
        override fun run() {
            fetchAndRefresh()
            handler.postDelayed(this, REFRESH_INTERVAL_MS)
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createNotificationChannel()

        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val goal  = prefs.getInt(KEY_GOAL, 10000)
        // Show the last known step count immediately (from WidgetUpdateWorker cache)
        // so the notification never flashes 0 while waiting for HC to respond.
        val cachedSteps = prefs.getInt("steps", 0)

        try {
            startForeground(NOTIF_ID, buildNotification(cachedSteps, goal))
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed: ${e.message}", e)
            stopSelf()
            return START_NOT_STICKY
        }

        lastSteps = cachedSteps
        Log.d(TAG, "Service started — showing $cachedSteps steps (cached)")

        // Fetch fresh steps immediately, then repeat every 10s
        fetchAndRefresh()
        handler.postDelayed(refreshRunnable, REFRESH_INTERVAL_MS)

        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(refreshRunnable)
        serviceScope.cancel()
        Log.d(TAG, "Service destroyed")
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Step fetch via aggregate() ────────────────────────────────────────────

    private fun fetchAndRefresh() {
        // Always prefer the live in-memory step count from StepCounterService.
        // This works on ALL API levels (including 34+) since we now start the
        // native sensor service everywhere. It updates on every sensor event,
        // giving true real-time accuracy without Health Connect's batching delay.
        val liveSteps = StepCounterService.liveStepCount
        if (liveSteps >= 0) {
            val goalPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val goal = goalPrefs.getInt(KEY_GOAL, 10000)
            if (liveSteps != lastSteps) {
                lastSteps = liveSteps
                val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIF_ID, buildNotification(liveSteps, goal))
                Log.d(TAG, "Notification updated (live sensor): $liveSteps steps")
            }
            return
        }

        // Fallback: StepCounterService is not running (liveStepCount == -1).
        // Try SharedPreferences from StepCounterService as next best source.
        val stepPrefs = getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE)
        val persistedSteps = stepPrefs.getInt("dailySteps", 0)
        if (persistedSteps > 0) {
            val goalPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val goal = goalPrefs.getInt(KEY_GOAL, 10000)
            if (persistedSteps != lastSteps) {
                lastSteps = persistedSteps
                val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIF_ID, buildNotification(persistedSteps, goal))
                Log.d(TAG, "Notification updated (persisted): $persistedSteps steps")
            }
            return
        }

        // Last resort: query Health Connect (only if native sensor data unavailable)
        serviceScope.launch {
            try {
                val prefs  = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val goal   = prefs.getInt(KEY_GOAL, 10000)
                val zone   = ZoneId.systemDefault()
                val now    = Instant.now()
                val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()

                // Apply the same loginTimestamp filter used by the app UI and
                // WidgetUpdateWorker. On the first login day the notification
                // must show steps only from login time onward — not the full
                // day — so it stays consistent with what the app displays.
                val loginTs = prefs.getLong("loginTimestamp", 0L)
                val stepsStart = if (loginTs > 0L) {
                    val loginInstant = Instant.ofEpochMilli(loginTs)
                    // Use loginTimestamp only if it falls within today.
                    // On subsequent days loginTimestamp < midnight, so midnight wins.
                    if (loginInstant.isAfter(startOfDay)) loginInstant else startOfDay
                } else startOfDay

                val client = HealthConnectClient.getOrCreate(this@StepNotificationService)

                // readRecords + single-source dedup — same logic as HealthSyncHelper.
                // aggregate() sums steps from ALL origins (Sweatcoin, Google Fit, etc.)
                // causing inflation. We pick the single highest-count source instead.
                val stepRecords = client.readRecords(
                    ReadRecordsRequest(
                        StepsRecord::class,
                        TimeRangeFilter.between(stepsStart, now),
                    )
                ).records

                val stepsByOrigin = stepRecords
                    .groupBy { it.metadata.dataOrigin.packageName }
                    .mapValues { (_, records) -> records.sumOf { it.count } }

                val todaySteps = stepsByOrigin.values.maxOrNull()?.toInt() ?: 0
                Log.d(TAG, "Steps by origin: $stepsByOrigin → using $todaySteps")

                // Health Connect batches step data — it may not have flushed
                // today's steps yet (common early in the morning or after reboot).
                // Fall back to the cached value from WidgetUpdateWorker if HC
                // returns 0 but the cache has a non-zero value.
                val cachedSteps = prefs.getInt("steps", 0)
                val steps = if (todaySteps == 0 && cachedSteps > 0) cachedSteps else todaySteps

                Log.d(TAG, "Steps — HC aggregate: $todaySteps, cached: $cachedSteps, showing: $steps")

                if (steps != lastSteps) {
                    lastSteps = steps
                    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                    nm.notify(NOTIF_ID, buildNotification(steps, goal))
                    Log.d(TAG, "Notification updated: $steps steps")
                }
            } catch (e: Exception) {
                Log.w(TAG, "aggregate() failed: ${e.message} — using cached value")
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val steps = prefs.getInt("steps", 0)
                val goal  = prefs.getInt(KEY_GOAL, 10000)
                if (steps != lastSteps) {
                    lastSteps = steps
                    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                    nm.notify(NOTIF_ID, buildNotification(steps, goal))
                }
            }
        }
    }

    // ── Notification ──────────────────────────────────────────────────────────

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Live Step Counter",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shows your live step count for today"
            setShowBadge(false)
        }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    private fun buildNotification(steps: Int, goal: Int): Notification {
        val progress       = if (goal > 0) ((steps.toFloat() / goal) * 100).toInt().coerceIn(0, 100) else 0
        val stepsFormatted = if (steps >= 1000) String.format("%,d", steps) else steps.toString()
        val goalFormatted  = if (goal  >= 1000) String.format("%,d", goal)  else goal.toString()

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
        }
        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this, 0, it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("$stepsFormatted steps today")
            .setContentText("Goal: $goalFormatted steps · $progress% complete")
            .setProgress(100, progress, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingIntent)
            .build()
    }
}
