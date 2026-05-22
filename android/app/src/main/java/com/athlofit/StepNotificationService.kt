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
import androidx.health.connect.client.request.AggregateRequest
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
 * Step source: Health Connect aggregate() — the same API used by
 * WidgetUpdateWorker and HealthSyncHelper. It automatically deduplicates
 * overlapping records from multiple apps (Sweatcoin, Strava, etc.) and
 * uses the most authoritative source (the device's native step counter).
 * Works on every Android OEM without any package-name allowlist.
 *
 * Refreshes every 60 seconds via a Handler loop. Each refresh calls
 * aggregate() directly so the count is always current — no dependency
 * on WidgetUpdateWorker having run recently.
 */
class StepNotificationService : Service() {

    companion object {
        const val TAG = "StepNotificationService"
        const val CHANNEL_ID = "step_counter_live"
        const val NOTIF_ID = 1001

        private const val REFRESH_INTERVAL_MS = 60_000L
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

        // Fetch fresh steps from HC immediately, then repeat every 60 s
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
        serviceScope.launch {
            try {
                val prefs  = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val goal   = prefs.getInt(KEY_GOAL, 10000)
                val zone   = ZoneId.systemDefault()
                val now    = Instant.now()

                // Always read from midnight today — no loginTimestamp filter here.
                // The login filter is only needed for backend sync (to avoid
                // crediting pre-install steps as new). For display we always
                // want the full day's count.
                val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()

                val client = HealthConnectClient.getOrCreate(this@StepNotificationService)
                val result = client.aggregate(
                    AggregateRequest(
                        metrics         = setOf(StepsRecord.COUNT_TOTAL),
                        timeRangeFilter = TimeRangeFilter.between(startOfDay, now),
                    )
                )
                val todaySteps = result[StepsRecord.COUNT_TOTAL]?.toInt() ?: 0

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
