package com.athlofit

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
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
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * StepCounterService
 *
 * Foreground service that registers with the hardware TYPE_STEP_COUNTER sensor
 * and accumulates daily step counts. Runs continuously in the background with
 * a persistent notification showing the live step count.
 *
 * Step calculation:
 *   dailySteps = (cumulative - baseline) + rebootOffset
 *
 * Reboot detection:
 *   If the cumulative sensor value is < baseline, a reboot (or sensor reset)
 *   has occurred. The current dailySteps are added to rebootOffset, and the
 *   baseline is reset to the new cumulative value.
 *
 * Uses START_STICKY so the system restarts the service if it is killed.
 */
class StepCounterService : Service(), SensorEventListener {

    companion object {
        private const val TAG = "StepCounterService"
        private const val CHANNEL_ID = "step_counter_live"
        private const val NOTIF_ID = 1001
        private const val PREFS_NAME = "StepCounterPrefs"
        private const val WIDGET_PREFS_NAME = "StepsWidgetPrefs"
        private const val STEP_HISTORY_KEY = "stepHistory"

        /** Days of local step history retained in SharedPreferences. */
        private const val MAX_HISTORY_DAYS = 90
        private const val DEBUG_LOG_KEY = "stepDebugLog"
        private const val MAX_DEBUG_LINES = 50

        // Max report latency for sensor batching (0 = deliver immediately).
        // Previously 10 seconds, but budget devices (Mediatek/Techno/Infinix)
        // often ignore this hint and batch for much longer, causing steps to
        // appear "stuck". Setting to 0 + periodic flush() ensures delivery.
        private const val MAX_REPORT_LATENCY_US = 0 // Deliver immediately

        // Sync interval: 15 minutes in milliseconds (requirement 9.4)
        private const val SYNC_INTERVAL_MS = 15 * 60 * 1000L

        // ── Update throttles ─────────────────────────────────────────────────
        // TYPE_STEP_COUNTER fires very frequently while walking. Without these
        // throttles the service issued one NotificationManager.notify(), one
        // SharedPreferences commit and one sendBroadcast() PER STEP. Android 13+
        // rate-limits notification posts and background broadcasts per package,
        // so the notification/widget ended up frozen at a stale count (the classic
        // "steps stuck" report) while the sensor was actually still counting.
        private const val NOTIFICATION_THROTTLE_MS = 5_000L
        private const val WIDGET_THROTTLE_MS = 10_000L

        // Minimum gap between two sensor listener re-registrations. Re-registering
        // tears down and re-activates the sensor HAL; doing it too often starves
        // event delivery entirely on sensor-hub based devices.
        private const val REREGISTER_MIN_INTERVAL_MS = 60_000L

        // How many consecutive below-baseline readings are needed to accept a
        // hardware counter reset that elapsedRealtime did not confirm as a reboot.
        private const val RESET_CONFIRM_EVENTS = 3

        // Liveness heartbeat. StepServiceRestartWorker treats a heartbeat older
        // than HEARTBEAT_STALE_MS as "the service is dead, restart it".
        private const val HEARTBEAT_INTERVAL_MS = 60_000L
        const val HEARTBEAT_KEY = "serviceHeartbeat"
        const val HEARTBEAT_STALE_MS = 5 * 60 * 1000L

        /**
         * Appends a debug log entry to SharedPreferences for production debugging.
         * Keeps only the last MAX_DEBUG_LINES entries.
         */
        fun debugLog(context: Context, message: String) {
            try {
                val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val existing = prefs.getString(DEBUG_LOG_KEY, "") ?: ""
                val timestamp = java.text.SimpleDateFormat("HH:mm:ss.SSS", java.util.Locale.US).format(java.util.Date())
                val newLine = "[$timestamp] $message"
                val lines = existing.split("\n").filter { it.isNotEmpty() }.toMutableList()
                lines.add(newLine)
                // Keep only last N lines
                while (lines.size > MAX_DEBUG_LINES) lines.removeAt(0)
                prefs.edit().putString(DEBUG_LOG_KEY, lines.joinToString("\n")).apply()
            } catch (_: Exception) { /* non-fatal */ }
        }

        /**
         * Live in-memory step count accessible from NativeStepModule.getCurrentSteps()
         * without waiting for the 90-second SharedPreferences persist cycle.
         * Returns -1 if the service is not running (caller should fall back to SharedPreferences).
         */
        @Volatile
        var liveStepCount: Int = -1
            private set

        /** Last time a sensor event was received (ms since epoch). 0 if no event yet. */
        @Volatile
        var lastSensorEventTimeStatic: Long = 0L
            private set

        /** Total sensor events received this service session. */
        @Volatile
        var sensorEventCountStatic: Long = 0L
            private set

        /** True while the Health Connect fallback poller is active. */
        @Volatile
        var hcPollingModeStatic: Boolean = false
            private set

        /** True when the step counter sensor reports a hardware FIFO (flush is meaningful). */
        @Volatile
        var sensorSupportsFlushStatic: Boolean = false
            private set

        /** True when this device only delivers step events on listener re-registration. */
        @Volatile
        var pollByReregisterStatic: Boolean = false
            private set

        /** Number of sensor listener re-registrations this session (churn indicator). */
        @Volatile
        var reregisterCountStatic: Int = 0
            private set

        /**
         * Display step floor pushed from the JS layer (app UI's combined value).
         * The app UI combines native sensor + server baseline + HC offset, which
         * can be higher than the raw native sensor count alone. The notification
         * and widget should never show LESS than what the app is displaying.
         *
         * maybeUpdateNotification() and updateWidget() use max(dailySteps, displayStepFloor)
         * so the pushed value is never overwritten by a lower sensor reading.
         *
         * Reset to 0 at midnight.
         */
        @Volatile
        var displayStepFloor: Int = 0
            private set

        /**
         * Forcefully sets the liveStepCount to a corrected value.
         * Used only by correctInflatedSteps to fix the persisted inflation bug.
         */
        fun setLiveStepCountCorrected(steps: Int) {
            liveStepCount = steps
        }

        /**
         * Updates the live step count from an external source (e.g., JS layer pushing
         * a fresher Health Connect value). Only applies if the new value is higher
         * than the current count, preventing stale data from overwriting real-time sensor data.
         * Also updates the notification and widget immediately.
         *
         * @param steps The step count to apply (only if > current liveStepCount).
         * @param context Context for SharedPreferences and notification updates.
         * @return true if the value was applied, false if current value is already higher.
         */
        fun pushStepUpdate(rawSteps: Int, context: Context): Boolean {
            // Sanity gate on values coming from JS (Health Connect / server derived).
            // Nothing downstream validated these, so a bad value could pin the
            // notification and widget to nonsense for the rest of the day.
            if (rawSteps < 0 || rawSteps > MAX_SANE_DAILY_STEPS) {
                Log.w(TAG, """
                    ════════════════════════════════════════════════════════════════
                    ❌ PUSH_REJECTED: Out of range value
                    ════════════════════════════════════════════════════════════════
                    Steps received: $rawSteps
                    Valid range: 0 to $MAX_SANE_DAILY_STEPS
                    Reason: Value is negative or impossibly high
                    Action: Rejected - notification/widget not updated
                    ════════════════════════════════════════════════════════════════
                """.trimIndent())
                return false
            }
            
            // CRITICAL: Reject JS updates during the first 2 minutes after midnight reset.
            // This prevents stale cached data from JS (loadData/sync) from overwriting
            // the notification's 0 display immediately after native service performed
            // midnight reset. Native sensor will confirm reset by reporting steps <= 50.
            val instance = serviceInstance
            if (instance != null && instance.lastMidnightResetTime > 0) {
                val msSinceReset = System.currentTimeMillis() - instance.lastMidnightResetTime
                if (msSinceReset < 2 * 60_000L && rawSteps > 50) {
                    Log.w(TAG, """
                        ════════════════════════════════════════════════════════════════
                        🛑 PUSH_REJECTED: Midnight reset gate active
                        ════════════════════════════════════════════════════════════════
                        Steps received from JS: $rawSteps
                        Time since midnight reset: ${msSinceReset/1000}s
                        Gate duration: 120s (2 minutes)
                        Current liveStepCount: $liveStepCount
                        Reason: Preventing stale cached data from overwriting 0 steps
                        Action: Rejected - wait for native sensor to confirm reset
                        Note: Gate opens when native sensor reports ≤50 steps OR after 120s
                        ════════════════════════════════════════════════════════════════
                    """.trimIndent())
                    return false
                }
            }
            
            val steps = rawSteps
            // Do NOT update liveStepCount here. liveStepCount is owned by the
            // hardware sensor (onSensorChanged). Updating it from Health Connect or
            // server values creates a circular inflation loop:
            //   HC/server value → liveStepCount → getCurrentSteps() → fed back to HC
            // Only the notification/widget DISPLAY is raised.
            if (steps <= liveStepCount && liveStepCount >= 0) return false

            // Only update displayStepFloor if the new value is higher — never decrease.
            // This prevents a stale loadData result from lowering the notification.
            if (steps > displayStepFloor) {
                displayStepFloor = steps
            }

            // Update widget SharedPreferences
            val widgetPrefs = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
            widgetPrefs.edit()
                .putInt("steps", steps)
                .putLong("lastUpdated", System.currentTimeMillis())
                .apply()

            // Update notification via the shared builder (previously this method
            // duplicated the whole NotificationCompat.Builder chain, recreated the
            // notification channel on every call, and skipped the stale-date guard
            // that buildNotification applies).
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            if (nm != null) {
                ensureNotificationChannel(context, nm)
                try {
                    nm.notify(NOTIF_ID, buildNotification(context, steps))
                } catch (_: Exception) { /* non-fatal */ }
            }

            // Trigger widget refresh broadcast
            try {
                val appWidgetManager = AppWidgetManager.getInstance(context)
                val componentName = ComponentName(context, StepsWidgetProvider::class.java)
                val ids = appWidgetManager.getAppWidgetIds(componentName)
                if (ids.isNotEmpty()) {
                    val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
                        component = componentName
                        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                    }
                    context.sendBroadcast(intent)
                }
            } catch (_: Exception) { /* non-fatal */ }

            return true
        }

        /**
         * Creates the step notification channel if it does not exist yet.
         * Cheap to call repeatedly — unlike createNotificationChannel(), which the
         * old pushStepUpdate re-ran on every single call.
         */
        fun ensureNotificationChannel(context: Context, nm: NotificationManager) {
            if (nm.getNotificationChannel(CHANNEL_ID) != null) return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Live Step Counter",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows your live step count for today"
                setShowBadge(false)
                setSound(null, null)
                enableVibration(false)
            }
            nm.createNotificationChannel(channel)
        }

        /**
         * Builds the ongoing step notification (step count, goal, percentage, progress).
         *
         * Applies a stale-date guard: if the persisted tracking date is not today,
         * 0 is shown instead of the passed value, so a missed midnight reset can
         * never surface yesterday's total.
         */
        fun buildNotification(context: Context, steps: Int): Notification {
            val stepPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val storedDate = stepPrefs.getString("storedDate", "") ?: ""
            val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            val safeSteps = if (storedDate.isNotEmpty() && storedDate != today) 0 else maxOf(0, steps)

            val goal = context.getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
                .getInt("goal", 10000)
            val percentage =
                if (goal > 0) ((safeSteps.toLong() * 100) / goal).toInt().coerceIn(0, 100) else 0
            val stepsFormatted = String.format("%,d", safeSteps)
            val goalFormatted = String.format("%,d", goal)

            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                    putExtra("screen", "steps")
                }
            val pendingIntent = launchIntent?.let {
                PendingIntent.getActivity(
                    context, 0, it,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
            }

            return NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("$stepsFormatted steps today")
                .setContentText("Goal: $goalFormatted \u2022 $percentage% complete")
                .setProgress(100, percentage, false)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(pendingIntent)
                .build()
        }

        /**
         * Convenience method to start the service from any context.
         *
         * Returns false when the platform refused the start instead of throwing.
         * Android 12+ throws ForegroundServiceStartNotAllowedException when a
         * foreground service is started while the app is in the background, which
         * is exactly what the 15-minute keepalive worker and OEM restart paths do.
         * Callers used to let that exception propagate, so those code paths failed
         * silently and the service was never revived.
         */
        fun start(context: Context): Boolean {
            return try {
                context.startForegroundService(Intent(context, StepCounterService::class.java))
                true
            } catch (e: Exception) {
                Log.w(TAG, "startForegroundService refused: ${e.javaClass.simpleName}: ${e.message}")
                debugLog(context, "START_REFUSED: ${e.javaClass.simpleName}")
                false
            }
        }

        /**
         * Convenience method to stop the service from any context.
         */
        fun stop(context: Context) {
            liveStepCount = -1
            context.stopService(Intent(context, StepCounterService::class.java))
        }

        /**
         * Requests a sensor flush from the running service instance.
         * Called from NativeStepModule.getCurrentSteps() to ensure batched events
         * are delivered before returning the step count. Non-blocking, best-effort.
         */
        fun requestFlush() {
            serviceInstance?.let { instance ->
                // Skip sensors with no hardware FIFO — flush() is a no-op there and
                // this is called from getCurrentSteps(), which JS polls frequently.
                if (!instance.sensorSupportsFlush) return
                try {
                    instance.sensorManager?.flush(instance)
                } catch (_: Exception) { /* non-fatal */ }
            }
        }

        /** Weak reference to the running service instance for flush requests. */
        @Volatile
        private var serviceInstance: StepCounterService? = null
    }

    // ── Step counting state ───────────────────────────────────────────────────

    /** Sensor value at start of day (or after last reboot detection). */
    private var baseline: Long = 0L

    /** Accumulated steps today (calculated from sensor events). */
    private var dailySteps: Int = 0

    /** Steps accumulated before the last detected reboot. */
    private var rebootOffset: Int = 0

    /** Date string (YYYY-MM-DD) of the current tracking day. */
    private var storedDate: String = ""

    /** Timestamp of last SharedPreferences write. */
    private var lastPersistTime: Long = 0L

    /** Timestamp of last liveness heartbeat write. */
    private var lastHeartbeatTime: Long = 0L

    /** Timestamp of last network sync. */
    private var lastSyncTime: Long = 0L

    /** Step count at the time of last successful sync (FIX #8: skip sync if unchanged). */
    private var lastSyncedSteps: Int = -1

    /** Unsent sync payload retained after a failed sync attempt. */
    private var pendingSyncPayload: String = ""

    /** Timestamp of last notification update (enforces NOTIFICATION_THROTTLE_MS). */
    private var lastNotificationUpdateTime: Long = 0L

    /** Timestamp of last widget prefs write + broadcast (enforces WIDGET_THROTTLE_MS). */
    private var lastWidgetUpdateTime: Long = 0L

    /** Last step value pushed to the notification (skip redundant notify calls). */
    private var lastNotifiedSteps: Int = -1

    /** Last step value written to the widget (skip redundant broadcasts). */
    private var lastWidgetSteps: Int = -1

    /** Whether we have received the first sensor event (used for baseline initialization). */
    private var hasReceivedFirstEvent: Boolean = false

    /** Last known cumulative sensor value (used for midnight reset baseline). */
    private var lastCumulative: Long = 0L

    /**
     * SystemClock.elapsedRealtime() at the last sensor event, persisted across
     * service restarts.
     *
     * elapsedRealtime() counts milliseconds since boot: it restarts at 0 on every
     * reboot and is monotonic within a boot session. So a value lower than the one
     * we stored proves the device rebooted in between — which is exactly what a
     * TYPE_STEP_COUNTER reset means. This is how the service tells a real reboot
     * apart from a sensor HAL glitch, instead of assuming any drop in the
     * cumulative value is a reboot.
     */
    private var lastElapsedRealtime: Long = 0L

    /**
     * Consecutive sensor events whose cumulative value was below the baseline
     * while elapsedRealtime said no reboot happened.
     *
     * One or two of these is a HAL glitch and gets ignored. If it keeps happening
     * the counter genuinely restarted mid-boot (some hubs do this after a crash),
     * so after RESET_CONFIRM_EVENTS we accept it and re-baseline.
     */
    private var consecutiveDropCount: Int = 0

    /** Coroutine scope for Health Connect reads (requires suspend functions). */
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ── Health Connect polling mode (when native sensor is unavailable) ───────

    /** Whether service is running in HC-only polling mode (no native sensor). */
    private var isHcPollingMode: Boolean = false

    /** Handler for periodic HC polling in HC-only mode. */
    private val hcHandler = Handler(Looper.getMainLooper())

    /** Last step count from HC poll (to avoid redundant notification updates). */
    private var lastHcPollSteps: Int = -1

    /** HC polling interval: 10 seconds for near-real-time notification updates. */
    private val HC_POLL_INTERVAL_MS = 10_000L

    private val hcPollRunnable = object : Runnable {
        override fun run() {
            // In HC-only mode the sensor watchdog never runs, so the heartbeat has
            // to be written here too.
            maybeWriteHeartbeat()
            pollHealthConnectAndUpdateNotification()
            hcHandler.postDelayed(this, HC_POLL_INTERVAL_MS)
        }
    }

    // ── Sensor watchdog ───────────────────────────────────────────────────────
    // Runs every 10 seconds and, in order of escalation:
    //   1. flush()es the sensor if it has a hardware FIFO (batching devices)
    //   2. after 30s of silence, re-registers the listener (max once per 60s)
    //   3. after 90s of silence, brings up Health Connect as a fallback source
    //   4. drops the Health Connect fallback again once the sensor recovers
    //
    // Devices whose HAL only emits a cached value at registration time are put in
    // "poll-by-reregister" mode, where the periodic re-registration IS the
    // delivery mechanism and the 60s rate limit is bypassed.
    private val flushHandler = Handler(Looper.getMainLooper())
    private val FLUSH_INTERVAL_MS = 10_000L // Flush every 10 seconds

    /** Indicates this device needs "poll-by-reregister" mode (sensor only fires on register). */
    private var needsPollByReregister: Boolean = false

    /** Timestamp of the last sensor listener re-registration (rate-limits churn). */
    private var lastReregisterTime: Long = 0L

    /** Timestamp the sensor listener was first registered (silence baseline). */
    private var serviceStartTime: Long = 0L
    
    /** Timestamp of last midnight reset (used to gate JS updates for 2 minutes). */
    private var lastMidnightResetTime: Long = 0L

    /** True when the hardware step counter reports batching support (FIFO > 0). */
    private var sensorSupportsFlush: Boolean = false

    /**
     * Re-registers the TYPE_STEP_COUNTER listener, but at most once every
     * REREGISTER_MIN_INTERVAL_MS.
     *
     * Every re-registration deactivates and reactivates the sensor. On devices
     * where the step counter lives in a sensor hub, reactivation has a latency of
     * several seconds; if we re-register faster than that latency the listener
     * never delivers a single event and the count freezes permanently. The old
     * code re-registered every 10s (whenever flush() returned false, which is the
     * normal return value for a sensor without a FIFO) and once per step from the
     * step-detector heartbeat, which is exactly that failure mode.
     *
     * @param reason Short tag for the debug log.
     * @return true if a re-registration was actually performed.
     */
    private fun reregisterSensor(reason: String): Boolean {
        val sm = sensorManager ?: return false
        val sensor = stepSensor ?: return false

        val now = System.currentTimeMillis()
        if (now - lastReregisterTime < REREGISTER_MIN_INTERVAL_MS) return false
        lastReregisterTime = now
        reregisterCountStatic++

        sm.unregisterListener(this, sensor)
        val success = sm.registerListener(
            this,
            sensor,
            SensorManager.SENSOR_DELAY_NORMAL,
            MAX_REPORT_LATENCY_US
        )
        debugLog(this, "REREGISTER[$reason]: success=$success (events=$sensorEventCount)")
        Log.w(TAG, "Re-registered step counter listener [$reason] success=$success (API ${Build.VERSION.SDK_INT}, ${Build.MANUFACTURER})")
        return success
    }

    /** Starts Health Connect polling as a fallback data source (idempotent). */
    private fun startHcPolling(reason: String) {
        if (isHcPollingMode) return
        isHcPollingMode = true
        hcPollingModeStatic = true
        debugLog(this, "HC_FALLBACK: Activating HC polling ($reason)")
        Log.w(TAG, "Activating Health Connect polling fallback ($reason)")
        pollHealthConnectAndUpdateNotification()
        hcHandler.removeCallbacks(hcPollRunnable)
        hcHandler.postDelayed(hcPollRunnable, HC_POLL_INTERVAL_MS)
    }

    /**
     * Stops Health Connect polling once the hardware sensor is healthy again.
     *
     * Leaving it running let the 10s HC poll overwrite liveStepCount with the HC
     * value while onSensorChanged was writing the (higher) hardware value, so
     * getCurrentSteps() alternated between two numbers and the UI looked stuck or
     * bounced backwards.
     */
    private fun stopHcPolling(reason: String) {
        if (!isHcPollingMode) return
        isHcPollingMode = false
        hcPollingModeStatic = false
        hcHandler.removeCallbacks(hcPollRunnable)
        lastHcPollSteps = -1
        debugLog(this, "HC_FALLBACK: Deactivated ($reason)")
        Log.d(TAG, "Health Connect polling fallback deactivated ($reason)")
    }

    private val flushRunnable = object : Runnable {
        override fun run() {
            val now = System.currentTimeMillis()
            val silenceMs = if (lastSensorEventTime > 0L) now - lastSensorEventTime else (now - serviceStartTime)

            // Prove liveness even while the sensor is silent — the watchdog ticking
            // is what makes the service "alive", not the arrival of step events.
            maybeWriteHeartbeat()

            // ── Retry sensor registration if in HC-only mode ────────────────────
            // If sensor registration failed on start, periodically retry. Sensor may
            // become available after app is whitelisted from battery optimization or
            // doze mode ends. Retry every 60s to avoid excessive overhead.
            if (sensorManager == null && (now - serviceStartTime) > 60_000L && (now - serviceStartTime) % 60_000L < 15_000L) {
                val elapsedSec = (now - serviceStartTime) / 1000
                Log.d(TAG, """
                    ════════════════════════════════════════════════════════════════
                    🔄 SENSOR_RETRY: Attempting sensor re-registration
                    ════════════════════════════════════════════════════════════════
                    Time since service start: ${elapsedSec}s
                    Current mode: Health Connect only (native sensor unavailable)
                    Retry attempt: Every 60 seconds
                    Reason: Sensor may have become available after:
                      • Battery optimization disabled
                      • Doze mode ended
                      • Permission granted
                      • Device unlocked
                    ════════════════════════════════════════════════════════════════
                """.trimIndent())
                val registered = registerSensorListener()
                if (registered) {
                    Log.d(TAG, """
                        ════════════════════════════════════════════════════════════════
                        ✅ SENSOR_RETRY_SUCCESS: Sensor now available!
                        ════════════════════════════════════════════════════════════════
                        Time to recovery: ${elapsedSec}s
                        Previous mode: Health Connect only
                        New mode: Native sensor (real-time updates)
                        Action: Stopping Health Connect polling, using native sensor
                        ════════════════════════════════════════════════════════════════
                    """.trimIndent())
                    stopHcPolling("sensor available after retry")
                    // Don't return here — let the rest of the watchdog continue
                } else {
                    Log.w(TAG, """
                        ════════════════════════════════════════════════════════════════
                        ⚠️ SENSOR_RETRY_FAIL: Sensor still unavailable
                        ════════════════════════════════════════════════════════════════
                        Time elapsed: ${elapsedSec}s
                        Current mode: Still on Health Connect only
                        Next retry: In 60 seconds
                        Reason: See SENSOR_FAIL logs above for specific reason
                        ════════════════════════════════════════════════════════════════
                    """.trimIndent())
                }
            }

            // Only ask for a flush when the sensor actually has a hardware FIFO.
            // On sensors with fifoMaxEventCount == 0 flush() always returns false,
            // which the old code (incorrectly) treated as "sensor is broken" and
            // used as a trigger to re-register every 10 seconds.
            if (sensorSupportsFlush) {
                try {
                    sensorManager?.flush(this@StepCounterService)
                } catch (_: Exception) { /* non-fatal */ }
            }

            // ── Poll-by-reregister mode ──────────────────────────────────────
            // Devices whose HAL only emits a cached value on registration. Here a
            // periodic re-register IS the delivery mechanism, so it is allowed to
            // run on the flush interval — but only while the sensor stays silent.
            if (needsPollByReregister) {
                if (silenceMs > 5_000L) {
                    lastReregisterTime = 0L // bypass the rate limit in poll mode
                    reregisterSensor("poll-mode")
                }
                if (silenceMs > 60_000L) {
                    startHcPolling("poll mode silent ${silenceMs / 1000}s")
                }
            } else if (silenceMs > 30_000L) {
                // ── Genuine silence — kick the driver, rate limited ───────────
                reregisterSensor("silence ${silenceMs / 1000}s")
            }

            // Health Connect fallback once the sensor has been quiet for 90s.
            // Applies on every API level (the previous 120s threshold combined
            // with the re-register churn meant affected devices sat dead for
            // minutes before any fallback kicked in).
            if (silenceMs > 90_000L) {
                startHcPolling("sensor silent ${silenceMs / 1000}s")
            }

            // Sensor is healthy again — drop the HC fallback so it stops fighting
            // the hardware value for ownership of liveStepCount.
            if (isHcPollingMode && !needsPollByReregister && lastSensorEventTime > 0L && silenceMs < 30_000L) {
                stopHcPolling("sensor recovered")
            }

            // Safety net: re-publish the current count to JS/notification/widget.
            // The notification and widget calls are throttled internally, so this
            // is cheap even though it runs every 10 seconds.
            //
            // liveStepCount is only ever raised here. Assigning it unconditionally
            // would undo a higher value set by the Health Connect fallback, so the
            // two sources would overwrite each other every 10 seconds.
            if (dailySteps > 0) {
                if (dailySteps > liveStepCount) liveStepCount = dailySteps
                NativeStepModule.emitStepUpdate(maxOf(dailySteps, liveStepCount), forceEmit = true)
                maybeUpdateNotification()
                updateWidget()
            }

            flushHandler.postDelayed(this, FLUSH_INTERVAL_MS)
        }
    }

    // ── System references ─────────────────────────────────────────────────────

    private var sensorManager: SensorManager? = null
    private var stepSensor: Sensor? = null

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand called")
        serviceInstance = this

        // Check if this is a midnight reset trigger from MidnightResetReceiver
        val isMidnightReset = intent?.getBooleanExtra(MidnightResetReceiver.EXTRA_MIDNIGHT_RESET, false) ?: false

        // Create notification channel and start as foreground service immediately
        createNotificationChannel()
        try {
            // If service is already running (re-entry from JS resume call),
            // use the live in-memory step count for the notification instead of
            // reading stale SharedPreferences. This prevents the notification
            // from briefly dropping to an old value on app resume.
            val notifSteps: Int
            if (sensorManager != null && liveStepCount >= 0) {
                // Service already running — use live count
                notifSteps = maxOf(liveStepCount, displayStepFloor)
            } else {
                // Fresh start — read from SharedPreferences
                val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                val storedDate = prefs.getString("storedDate", "") ?: ""
                val todayStr = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
                notifSteps = if (storedDate == todayStr) prefs.getInt("dailySteps", 0) else 0
            }
            startForeground(NOTIF_ID, buildStepNotification(notifSteps))
            lastNotificationUpdateTime = System.currentTimeMillis()
            lastNotifiedSteps = notifSteps
        } catch (e: Exception) {
            // Do NOT stopSelf() here.
            //
            // startForeground can legitimately fail without the sensor being
            // unusable:
            //  - Android 12+ throws ForegroundServiceStartNotAllowedException when
            //    the service is started while the app sits in the background (the
            //    15-minute keepalive worker and some OEM restarts hit this).
            //  - Android 14+ throws SecurityException when the "health" foreground
            //    service type has no granted prerequisite permission
            //    (ACTIVITY_RECOGNITION).
            // The previous code responded by killing the service and returning
            // START_NOT_STICKY, so the system never restarted it and step counting
            // stopped for the rest of the day. Instead, keep running as a plain
            // background service (still counts while the process is alive) and
            // return START_STICKY so the system brings it back.
            Log.e(TAG, "startForeground failed: ${e.message}", e)
            debugLog(this, "FGS_FAIL: ${e.javaClass.simpleName}: ${e.message}")
        }

        // Load persisted state ONLY if this is a fresh start (sensor not yet registered).
        // If the service is already running (sensorManager != null), onStartCommand was
        // triggered by a redundant startForegroundService() call from the JS layer
        // (e.g., on app resume). In that case, the in-memory dailySteps is MORE CURRENT
        // than SharedPreferences (which is only persisted every 90s). Loading from prefs
        // would overwrite the live count with a stale value, causing steps to drop.
        if (sensorManager == null) {
            loadPersistedState()
        }

        // If triggered by midnight alarm and service was already running,
        // perform midnight reset directly for immediate effect
        if (isMidnightReset) {
            Log.d(TAG, "onStartCommand — midnight reset triggered via intent extra")
            val today = java.time.LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            if (storedDate.isNotEmpty() && storedDate != today) {
                handleMultiDayGap(storedDate, today)
            } else {
                // storedDate already matches today because MidnightResetReceiver
                // updated SharedPrefs before starting the service. Still perform
                // a full midnight reset to ensure liveStepCount=0, emit 0 to JS,
                // and re-confirm baseline=lastCumulative in memory.
                performMidnightReset()
            }
        } else {
            // Normal start: detect date change and perform midnight reset if needed
            handleDateChangeOnStart()
        }

        // Schedule midnight alarm as fallback reset trigger
        scheduleMidnightAlarm()

        // Register sensor listener (no-op if already registered)
        if (sensorManager == null) {
            val registered = registerSensorListener()
            if (!registered) {
                // Native sensor unavailable — Health Connect is the only source.
                Log.d(TAG, "Native sensor unavailable — switching to Health Connect polling mode")
                startHcPolling("native sensor unavailable")
            }
            
            // CRITICAL: Always start the watchdog (flushHandler), even in HC-only mode.
            // The watchdog does sensor retry attempts, heartbeat writes, and periodic
            // notification/widget updates. Previously this only ran when sensor succeeded,
            // so fresh installs stuck at "HC_FALLBACK" forever with no retry or updates.
            flushHandler.removeCallbacks(flushRunnable)
            flushHandler.postDelayed(flushRunnable, FLUSH_INTERVAL_MS)
        }

        Log.d(TAG, "Service started — baseline=$baseline, dailySteps=$dailySteps, rebootOffset=$rebootOffset, storedDate=$storedDate")

        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy — persisting state and unregistering sensor")
        serviceInstance = null
        // Stop HC polling if active
        stopHcPolling("service destroyed")
        // Stop sensor flush timer
        flushHandler.removeCallbacks(flushRunnable)
        // Cancel coroutine scope
        serviceScope.cancel()
        // Persist current state before shutdown
        persistState()
        // Mark the service as no longer running.
        //
        // liveStepCount was previously left at its last value here, so
        // StepServiceRestartWorker (which tests liveStepCount < 0) never noticed the
        // service had died as long as the app process survived. Clearing the
        // heartbeat too makes the next worker tick restart the service instead of
        // waiting for the process to die.
        liveStepCount = -1
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putLong(HEARTBEAT_KEY, 0L)
            .apply()
        // Unregister sensor listeners (counter + detector)
        sensorManager?.unregisterListener(this)
        sensorManager?.unregisterListener(stepDetectorListener)
        // Emit service stopped event to JS layer
        NativeStepModule.emitServiceStopped()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Sensor Registration ───────────────────────────────────────────────────

    /**
     * Registers the TYPE_STEP_COUNTER sensor listener with SENSOR_DELAY_NORMAL
     * and immediate delivery (MAX_REPORT_LATENCY_US = 0).
     *
     * Also registers TYPE_STEP_DETECTOR as a backup wake-up mechanism.
     * On some OEM devices (Android 10), the step counter listener gets silently
     * killed. The step detector (which fires per-step) can survive longer and
     * serves as a "heartbeat" to detect that the user is still walking,
     * triggering a counter re-registration when silence is detected.
     *
     * @return true if at least the counter registration succeeded, false otherwise.
     */
    private fun registerSensorListener(): Boolean {
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        if (sensorManager == null) {
            Log.e(TAG, """
                ════════════════════════════════════════════════════════════════
                ❌ SENSOR_FAIL: SensorManager unavailable
                ════════════════════════════════════════════════════════════════
                Reason: SensorManager system service returned null
                Impact: Native sensor cannot be used - falling back to Health Connect
                Possible causes:
                  • System service not initialized yet (rare)
                  • Device doesn't support sensor framework (very rare)
                Action: Will retry every 60 seconds
                ════════════════════════════════════════════════════════════════
            """.trimIndent())
            debugLog(this, "SENSOR_FAIL: SensorManager null")
            return false
        }

        stepSensor = sensorManager!!.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (stepSensor == null) {
            Log.e(TAG, """
                ════════════════════════════════════════════════════════════════
                ❌ SENSOR_FAIL: Step counter sensor not available
                ════════════════════════════════════════════════════════════════
                Sensor type: TYPE_STEP_COUNTER
                Reason: Device doesn't have step counter hardware sensor
                Impact: Native sensor cannot be used - falling back to Health Connect
                Note: This is expected on devices without step counter hardware
                Action: Will use Health Connect as primary data source
                ════════════════════════════════════════════════════════════════
            """.trimIndent())
            debugLog(this, "SENSOR_FAIL: No step counter sensor")
            return false
        }

        // Does this sensor actually support flush()? A sensor with no hardware FIFO
        // always returns false from flush(), so calling it is pointless and its
        // return value says nothing about sensor health.
        sensorSupportsFlush = stepSensor!!.fifoMaxEventCount > 0
        sensorSupportsFlushStatic = sensorSupportsFlush

        serviceStartTime = System.currentTimeMillis()
        lastReregisterTime = System.currentTimeMillis()

        Log.d(TAG, """
            ════════════════════════════════════════════════════════════════
            📡 SENSOR_REGISTER: Attempting sensor registration
            ════════════════════════════════════════════════════════════════
            Sensor type: TYPE_STEP_COUNTER
            Vendor: ${stepSensor!!.vendor}
            FIFO size: ${stepSensor!!.fifoMaxEventCount} events
            Power: ${stepSensor!!.power} mA
            Flush support: ${if (sensorSupportsFlush) "Yes" else "No (no FIFO)"}
            Delay: SENSOR_DELAY_NORMAL
            Max latency: ${MAX_REPORT_LATENCY_US / 1_000_000}s
            ════════════════════════════════════════════════════════════════
        """.trimIndent())
        debugLog(this, "SENSOR_REGISTER: fifo=${stepSensor!!.fifoMaxEventCount}, vendor=${stepSensor!!.vendor}")

        val success = sensorManager!!.registerListener(
            this,
            stepSensor,
            SensorManager.SENSOR_DELAY_NORMAL,
            MAX_REPORT_LATENCY_US
        )

        if (!success) {
            Log.e(TAG, """
                ════════════════════════════════════════════════════════════════
                ❌ SENSOR_FAIL: registerListener returned false
                ════════════════════════════════════════════════════════════════
                Sensor: ${stepSensor!!.name} (${stepSensor!!.vendor})
                Reason: One of the following:
                  • Sensor is busy/in use by another app
                  • App doesn't have ACTIVITY_RECOGNITION permission
                  • Sensor temporarily unavailable (battery optimization)
                  • OEM restriction on sensor access
                Impact: Native sensor cannot be used - falling back to Health Connect
                Action: Will retry every 60 seconds
                Fix: 
                  1. Grant ACTIVITY_RECOGNITION permission in Settings
                  2. Disable battery optimization for Athlofit
                  3. Restart device if sensor is stuck
                ════════════════════════════════════════════════════════════════
            """.trimIndent())
            debugLog(this, "SENSOR_FAIL: registerListener=false")
        } else {
            Log.d(TAG, """
                ════════════════════════════════════════════════════════════════
                ✅ SENSOR_SUCCESS: Sensor registered successfully
                ════════════════════════════════════════════════════════════════
                Sensor: ${stepSensor!!.name}
                Status: Listening for step events
                Mode: Native sensor (real-time updates)
                ════════════════════════════════════════════════════════════════
            """.trimIndent())
            debugLog(this, "SENSOR_SUCCESS: Registered")
        }

        // Register TYPE_STEP_DETECTOR as a backup "heartbeat" sensor.
        // This is a wake-up sensor on most devices — when it fires (per step),
        // we know the user is walking. If the counter is silent, the detector
        // event triggers a counter re-registration.
        val detector = sensorManager!!.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
        if (detector != null) {
            sensorManager!!.registerListener(
                stepDetectorListener,
                detector,
                SensorManager.SENSOR_DELAY_NORMAL
            )
            Log.d(TAG, "TYPE_STEP_DETECTOR registered as backup heartbeat (wakeUp=${detector.isWakeUpSensor})")
        }

        return success
    }

    /**
     * Backup listener for TYPE_STEP_DETECTOR.
     * When this fires but TYPE_STEP_COUNTER is silent, it means the counter
     * listener was killed by the OEM. Triggers a counter re-registration.
     */
    private val stepDetectorListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent?) {
            if (event == null || event.sensor.type != Sensor.TYPE_STEP_DETECTOR) return

            // If the counter has been silent for > 30 seconds while the detector is
            // firing, the counter listener is likely dead — kick it.
            //
            // The detector fires once per step, so this ran a full unregister +
            // register cycle on EVERY step while the counter was quiet. That churn
            // kept the counter permanently deactivated on sensor-hub devices, which
            // is the main reason the count froze while walking. reregisterSensor()
            // now enforces a 60s floor between re-registrations.
            val now = System.currentTimeMillis()
            val counterSilenceMs = if (lastSensorEventTime > 0L) now - lastSensorEventTime else (now - serviceStartTime)

            if (counterSilenceMs > 30_000L) {
                reregisterSensor("detector-wake ${counterSilenceMs / 1000}s")
            }
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
    }

    // ── SensorEventListener ───────────────────────────────────────────────────

    /** Timestamp of last sensor event (used to detect sensor silence on Android 10). */
    private var lastSensorEventTime: Long = 0L

    /** Count of total sensor events received this session (for diagnostics). */
    private var sensorEventCount: Long = 0L

    /** Last cumulative value from sensor event (for detecting stale re-register responses). */
    private var lastEventCumulative: Long = 0L

    /** Count of consecutive events with same cumulative (indicates sensor HAL is dead). */
    private var sameCumulativeCount: Int = 0

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

        val now = System.currentTimeMillis()
        val gapMs = if (lastSensorEventTime > 0L) now - lastSensorEventTime else 0L
        lastSensorEventTime = now
        sensorEventCount++

        // Update static accessors for diagnostics
        lastSensorEventTimeStatic = now
        sensorEventCountStatic = sensorEventCount

        // Log significant gaps (> 60 seconds) — helps identify OEM sensor batching/killing
        if (gapMs > 60_000L) {
            val gapSec = gapMs / 1000
            debugLog(this, "SENSOR_GAP: ${gapSec}s since last event (event#$sensorEventCount)")
            Log.w(TAG, "onSensorChanged — gap of ${gapSec}s since last event (possible OEM throttle/kill)")
        }

        // Log first 3 events for startup debugging
        if (sensorEventCount <= 3) {
            debugLog(this, "EVENT#$sensorEventCount: cum=${event.values[0].toLong()}, gap=${gapMs}ms")
        }

        val cumulative = event.values[0].toLong()

        // ── Detect "poll-by-reregister" pattern ──────────────────────────────
        // On some OEM devices (Mediatek/Unisoc Android 10), the sensor only
        // delivers a cached value on re-registration. If we see 3+ consecutive
        // events with the same cumulative and gaps of ~30s (our re-register interval),
        // switch to "poll-by-reregister" mode where we re-register every 10s
        // to keep the HAL alive and counting.
        if (cumulative == lastEventCumulative && gapMs > 25_000L) {
            sameCumulativeCount++
            if (sameCumulativeCount >= 2 && !needsPollByReregister) {
                needsPollByReregister = true
                pollByReregisterStatic = true
                debugLog(this, "POLL_MODE: Sensor stuck at $cumulative for $sameCumulativeCount events — switching to poll-by-reregister")
                Log.w(TAG, "Detected stale sensor: cumulative stuck at $cumulative for $sameCumulativeCount events. Activating poll-by-reregister mode.")
            }
        } else if (cumulative != lastEventCumulative) {
            // Cumulative changed — sensor is alive and counting
            sameCumulativeCount = 0
            // If we were in poll-by-reregister mode and sensor starts delivering
            // real updates again (e.g., after user whitelisted the app), keep the
            // mode active — it doesn't hurt and prevents regression.
        }
        lastEventCumulative = cumulative

        // lastCumulative is deliberately NOT set here. It seeds the baseline during
        // the midnight reset, so it must only ever hold a reading we have accepted
        // as valid — a glitched below-baseline value would poison tomorrow's
        // baseline. It is assigned after the counter-reset validation below.
        //
        // It is also no longer committed to SharedPreferences on every single event
        // (that was multiple disk writes per second while walking); persistState()
        // writes it on the normal 30s cycle.

        // Check if the day has changed since last event — handles the case where
        // the midnight alarm fires late or doesn't fire at all (Doze mode).
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        if (storedDate.isNotEmpty() && storedDate != today) {
            Log.d(TAG, "onSensorChanged — day changed ($storedDate → $today), performing midnight reset")
            persistStepHistory(storedDate, dailySteps)
            // performMidnightReset() seeds the new baseline from lastCumulative, so
            // only promote this reading if it is not a below-baseline glitch.
            if (cumulative >= baseline) lastCumulative = cumulative
            lastElapsedRealtime = SystemClock.elapsedRealtime()
            performMidnightReset()
            // After the reset, baseline == lastCumulative, so this event contributes
            // 0 steps — nothing more to do.
            return
        }

        // First event after service start: initialize baseline if not already set
        if (!hasReceivedFirstEvent) {
            hasReceivedFirstEvent = true
            if (baseline == 0L) {
                // Fresh start — no persisted baseline, use current cumulative
                baseline = cumulative
                lastCumulative = cumulative
                lastElapsedRealtime = SystemClock.elapsedRealtime()
                persistState()
                debugLog(this, "FIRST_EVENT: baseline set to $cumulative")
                Log.d(TAG, "First event — initialized baseline to $cumulative")
                return
            }
            debugLog(this, "FIRST_EVENT: baseline already set=$baseline, cumulative=$cumulative")
        }

        // ── Confirm whether the hardware counter actually restarted ──────────
        // Only a genuine restart may re-baseline and fold today's count into
        // rebootOffset. Two independent signals are used:
        //
        //  1. elapsedRealtime() went backwards since the last sensor event. It
        //     restarts at 0 on boot and is monotonic within a boot, so this is
        //     proof of a reboot and cannot be faked by a misbehaving sensor.
        //  2. The reading stayed below the baseline for RESET_CONFIRM_EVENTS
        //     consecutive events. Covers the rare mid-boot counter reset (sensor
        //     hub crash/restart) that signal 1 cannot see.
        //
        // A one-off dip below the baseline is treated as a HAL glitch and dropped.
        // Previously any dip was assumed to be a reboot, which is what inflated
        // the daily total a bit more on every glitch.
        val nowElapsed = SystemClock.elapsedRealtime()
        val rebooted = lastElapsedRealtime > 0L && nowElapsed < lastElapsedRealtime
        lastElapsedRealtime = nowElapsed

        var counterReset = false
        if (cumulative < baseline) {
            consecutiveDropCount++
            when {
                rebooted -> {
                    counterReset = true
                    debugLog(this, "REBOOT: cum=$cumulative < base=$baseline, elapsed reset, carrying $dailySteps")
                    Log.d(TAG, "Reboot confirmed via elapsedRealtime — carrying $dailySteps steps into offset")
                }
                consecutiveDropCount >= RESET_CONFIRM_EVENTS -> {
                    counterReset = true
                    debugLog(this, "COUNTER_RESET: cum=$cumulative < base=$baseline for $consecutiveDropCount events")
                    Log.w(TAG, "Sensor counter reset confirmed after $consecutiveDropCount drops — re-baselining")
                }
                else -> {
                    // Transient HAL glitch — ignore this reading entirely.
                    debugLog(this, "GLITCH_IGNORED: cum=$cumulative < base=$baseline (drop #$consecutiveDropCount)")
                    Log.w(TAG, "Ignoring below-baseline reading $cumulative (baseline=$baseline, drop #$consecutiveDropCount)")
                    return
                }
            }
        } else {
            consecutiveDropCount = 0
        }
        if (counterReset) consecutiveDropCount = 0

        // Reading accepted — safe to use as the midnight-reset baseline seed.
        lastCumulative = cumulative

        // Delegate step calculation to the pure function
        val state = StepState(baseline, dailySteps, rebootOffset)
        val result = calculateSteps(state, cumulative, counterReset)

        // Apply result
        baseline = result.baseline
        dailySteps = result.dailySteps
        rebootOffset = result.rebootOffset

        // Debug log every 100 steps or on significant changes
        if (result.dailySteps % 100 == 0 || result.dailySteps > 10000) {
            debugLog(this, "CALC: cum=$cumulative, base=${result.baseline}, offset=${result.rebootOffset}, daily=${result.dailySteps}")
        }

        // Update the live static step count so NativeStepModule.getCurrentSteps()
        // always returns the freshest value without waiting for SharedPreferences persist.
        liveStepCount = dailySteps

        // All four are internally throttled (30s persist / 15min sync /
        // 5s notification / 10s widget / 5s JS event).
        //
        // The service never writes steps back to Health Connect: the platform
        // sensor already records them there, and writing our own records made the
        // app read its own data back and inflate the count.
        maybePersist()
        maybeSync()
        maybeUpdateNotification()
        maybeEmitEvent()
        updateWidget()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // Monitor sensor accuracy changes. If sensor becomes unreliable or loses
        // contact, try to re-register to recover it. This handles cases where
        // battery optimization or sensor hub issues cause temporary unavailability.
        when (accuracy) {
            SensorManager.SENSOR_STATUS_UNRELIABLE -> {
                Log.w(TAG, """
                    ════════════════════════════════════════════════════════════════
                    ⚠️ SENSOR_ACCURACY: Unreliable
                    ════════════════════════════════════════════════════════════════
                    Sensor: ${sensor?.name ?: "unknown"}
                    Accuracy: UNRELIABLE
                    Reason: Sensor readings may be inaccurate
                    Impact: Steps may not be counted accurately
                    Action: Will attempt recovery on next watchdog cycle (10s)
                    Possible causes:
                      • Sensor calibration needed
                      • Hardware issue
                      • Environmental interference
                    ════════════════════════════════════════════════════════════════
                """.trimIndent())
                // Don't re-register immediately — let the watchdog handle it on next
                // cycle to avoid thrashing if accuracy is oscillating
            }
            SensorManager.SENSOR_STATUS_NO_CONTACT -> {
                Log.w(TAG, """
                    ════════════════════════════════════════════════════════════════
                    ❌ SENSOR_ACCURACY: No contact
                    ════════════════════════════════════════════════════════════════
                    Sensor: ${sensor?.name ?: "unknown"}
                    Accuracy: NO_CONTACT
                    Reason: Sensor has completely lost connection
                    Impact: Steps are NOT being counted
                    Action: Attempting immediate re-registration
                    Possible causes:
                      • Sensor hub crashed/restarted
                      • Battery optimization killed sensor
                      • Hardware failure
                    ════════════════════════════════════════════════════════════════
                """.trimIndent())
                // Immediate re-register on complete sensor loss (rate limited by reregisterSensor)
                reregisterSensor("accuracy NO_CONTACT")
            }
            SensorManager.SENSOR_STATUS_ACCURACY_LOW -> {
                Log.d(TAG, "SENSOR_ACCURACY: LOW (sensor usable but readings may be slightly inaccurate)")
            }
            SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM -> {
                Log.d(TAG, "SENSOR_ACCURACY: MEDIUM (sensor operating normally)")
            }
            SensorManager.SENSOR_STATUS_ACCURACY_HIGH -> {
                Log.d(TAG, "SENSOR_ACCURACY: HIGH (sensor operating at optimal accuracy)")
            }
        }
    }

    // ── Persistence (stub — filled in by task 2.2) ────────────────────────────

    /**
     * Persists step data to SharedPreferences at intervals no greater than 90 seconds.
     * Only writes if at least 90 seconds have elapsed since the last persist.
     */
    private fun maybePersist() {
        val now = System.currentTimeMillis()
        if (now - lastPersistTime >= 30_000L) {
            persistState()
            lastPersistTime = now
        }
    }

    /**
     * Writes a liveness heartbeat so StepServiceRestartWorker can tell whether the
     * service is actually alive.
     *
     * The worker used to test `StepCounterService.liveStepCount < 0`. That is a
     * static in the app process, and onDestroy() did not reset it, so whenever the
     * system killed just the service and left the process running the static kept
     * its last value, the worker concluded the service was fine, and it was never
     * restarted. A timestamp in SharedPreferences survives the service but goes
     * stale, which is the signal we actually want.
     */
    private fun maybeWriteHeartbeat() {
        val now = System.currentTimeMillis()
        if (now - lastHeartbeatTime < HEARTBEAT_INTERVAL_MS) return
        lastHeartbeatTime = now
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putLong(HEARTBEAT_KEY, now)
            .apply()
    }

    /**
     * Immediately persists the current state to SharedPreferences.
     * Used on service start/stop and reboot detection.
     */
    private fun persistState() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putLong("baseline", baseline)
            .putInt("dailySteps", dailySteps)
            .putInt("rebootOffset", rebootOffset)
            .putString("storedDate", storedDate)
            .putLong("lastSyncTime", lastSyncTime)
            .putInt("lastSyncedSteps", lastSyncedSteps)
            .putString("pendingSyncPayload", pendingSyncPayload)
            .putLong("lastCumulative", lastCumulative)
            .putLong("lastElapsedRealtime", lastElapsedRealtime)
            .apply()
    }

    /**
     * Loads persisted state from SharedPreferences on service start.
     */
    private fun loadPersistedState() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        baseline = prefs.getLong("baseline", 0L)
        dailySteps = prefs.getInt("dailySteps", 0)
        rebootOffset = prefs.getInt("rebootOffset", 0)
        storedDate = prefs.getString("storedDate", "") ?: ""
        lastSyncTime = prefs.getLong("lastSyncTime", 0L)
        lastSyncedSteps = prefs.getInt("lastSyncedSteps", -1)
        pendingSyncPayload = prefs.getString("pendingSyncPayload", "") ?: ""
        // Restore lastCumulative so midnight reset works even after service restart
        lastCumulative = prefs.getLong("lastCumulative", 0L)
        // Restore the boot-relative timestamp of the last accepted sensor event.
        // If the device rebooted while the service was down, the current
        // elapsedRealtime() will be lower than this, which is how the first sensor
        // event recognises the hardware counter reset.
        lastElapsedRealtime = prefs.getLong("lastElapsedRealtime", 0L)

        // displayStepFloor starts at 0 on each service start. It only gets raised
        // during the current session via pushStepUpdate (when the JS layer pushes
        // a combined HC+baseline value). This prevents stale inflated values from
        // previous sessions from locking the notification at an incorrect high count.
        displayStepFloor = 0

        // ── One-time migration off the step-inflation bug ─────────────────────
        // Older builds shipped four stacked migrations (inflationFixV2 / V4 / V5 /
        // V6). V6 is a strict superset of the others — it zeroes baseline,
        // dailySteps and rebootOffset and forces the next sensor event to
        // re-initialise the baseline — so V2/V4/V5 were removed. Anyone upgrading
        // from any older build still lands on the same clean state via V6.
        //
        // Do NOT bump this flag name: doing so re-runs the reset for every
        // existing user and wipes the steps they have already walked today.
        if (!prefs.getBoolean("inflationFixV6", false)) {
            debugLog(this, "FIX_V6: baseline reset (baseline=$baseline, daily=$dailySteps, lastCum=$lastCumulative)")
            baseline = 0L
            dailySteps = 0
            rebootOffset = 0
            hasReceivedFirstEvent = false
            prefs.edit()
                .putLong("baseline", 0L)
                .putInt("dailySteps", 0)
                .putInt("rebootOffset", 0)
                .putBoolean("inflationFixV6", true)
                .apply()
        }

        // NOTE: the old "FIX V3" block reset the stale-date state here AND set
        // storedDate = today. That ran before handleDateChangeOnStart(), so the
        // date transition was already consumed by the time it was called and
        // handleMultiDayGap() never ran — yesterday's total was never written to
        // step history. The stale-date case is now left entirely to
        // handleDateChangeOnStart() → handleMultiDayGap() → performMidnightReset(),
        // which applies the same baseline logic and also persists history.

        debugLog(this, "LOAD: daily=$dailySteps, offset=$rebootOffset, baseline=$baseline, date=$storedDate")

        // Keep live count in sync with persisted state on service start
        liveStepCount = dailySteps
    }

    // ── Sync ─────────────────────────────────────────────────────────────────

    /**
     * Triggers a background sync to POST /health/sync if enough time has elapsed.
     * Rate-limited to at most once every 15 minutes.
     * FIX #8: Skips the sync entirely if dailySteps hasn't changed since the last
     * successful sync — avoids unnecessary network calls when the user is idle.
     * Also retries any pending sync payload from a previous failed attempt.
     */
    private fun maybeSync() {
        val now = System.currentTimeMillis()
        if (now - lastSyncTime < SYNC_INTERVAL_MS) return

        // FIX #8: Skip sync if steps haven't changed and there's no pending retry.
        // This prevents POSTing identical data every 15 min when the phone is on a desk.
        if (dailySteps == lastSyncedSteps && pendingSyncPayload.isEmpty()) return

        // FIX: Date staleness guard — if storedDate doesn't match today, midnight
        // reset hasn't happened yet. Skip sync to prevent yesterday's steps from
        // being POSTed with today's date (race condition on OEMs that delay alarms).
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        if (storedDate.isNotEmpty() && storedDate != today) {
            Log.d(TAG, "maybeSync — skipping: storedDate=$storedDate != today=$today (midnight reset pending)")
            return
        }

        // FIX: Discard stale pending payload from a previous day. If the pending
        // payload contains a date that doesn't match today, it's leftover from a
        // failed sync yesterday — drop it instead of sending stale data.
        if (pendingSyncPayload.isNotEmpty()) {
            try {
                val pendingJson = JSONObject(pendingSyncPayload)
                val pendingDate = pendingJson.optString("date", "")
                if (pendingDate.isNotEmpty() && pendingDate != today) {
                    Log.d(TAG, "maybeSync — discarding stale pending payload (date=$pendingDate, today=$today)")
                    pendingSyncPayload = ""
                    persistState()
                }
            } catch (e: Exception) {
                // Malformed payload — discard it
                Log.w(TAG, "maybeSync — discarding malformed pending payload", e)
                pendingSyncPayload = ""
                persistState()
            }
        }

        // Build a fresh payload for the current step data
        val payload = buildSyncPayload()

        // If there's a pending payload from a previous failure, try that first
        val payloadToSync = if (pendingSyncPayload.isNotEmpty()) pendingSyncPayload else payload

        // Run network call on a background thread
        Thread {
            performSync(payloadToSync)
        }.start()
    }

    /**
     * Builds the JSON sync payload matching the POST /health/sync format.
     * Derives calories, distance, activeMinutes from steps using design formulas.
     * Uses default weight of 70.0 kg if weightKg is unavailable.
     *
     * @return JSON string with date, steps, calories, distance, activeMinutes, goalMet, timezone
     */
    private fun buildSyncPayload(): String {
        val widgetPrefs = getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val weightKg = widgetPrefs.getFloat("weightKg", 70.0f).toDouble()
        val dailyStepGoal = widgetPrefs.getInt("goal", 10000)

        val steps = dailySteps
        val calories = Math.floor(steps * weightKg * 0.57 / 1000.0).toInt()
        val distanceKm = Math.round(steps * 0.76 / 1000.0 * 100.0) / 100.0
        val activeMinutes = Math.floor(steps / 100.0).toInt()
        val goalMet = steps >= dailyStepGoal

        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        // FIX #3: Include device timezone (IANA name) so the server uses correct day boundary
        val timezone = java.util.TimeZone.getDefault().id

        val json = JSONObject().apply {
            put("date", today)
            put("steps", steps)
            put("calories", calories)
            put("distance", distanceKm)
            put("activeMinutes", activeMinutes)
            put("goalMet", goalMet)
            put("timezone", timezone)
        }

        return json.toString()
    }

    /**
     * Performs the actual HTTP POST to the backend /health/sync endpoint.
     * Reads the Bearer token and base URL from StepsWidgetPrefs SharedPreferences.
     *
     * On success: clears pendingSyncPayload, updates lastSyncTime, persists state.
     * On failure: stores the payload in pendingSyncPayload for retry next cycle.
     *
     * Uses a 15-second connect and read timeout.
     * Must be called from a background thread.
     */
    private fun performSync(payload: String) {
        // FIX #10: Read token from SecureTokenStore (encrypted) instead of plaintext prefs
        val accessToken = SecureTokenStore.getToken(this)
        val baseUrl = SecureTokenStore.getBaseUrl(this)

        if (accessToken.isEmpty()) {
            Log.w(TAG, "performSync — no accessToken available, retaining payload for retry")
            pendingSyncPayload = payload
            persistState()
            return
        }

        try {
            val url = java.net.URL("${baseUrl.trimEnd('/')}/health/sync")
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Authorization", "Bearer $accessToken")
                doOutput = true
                connectTimeout = 15_000
                readTimeout = 15_000
            }

            conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            val responseCode = conn.responseCode
            conn.disconnect()

            if (responseCode in 200..299) {
                Log.d(TAG, "performSync — success (HTTP $responseCode)")
                pendingSyncPayload = ""
                lastSyncTime = System.currentTimeMillis()
                lastSyncedSteps = dailySteps // FIX #8: track synced value
                persistState()
            } else {
                Log.w(TAG, "performSync — failed (HTTP $responseCode), retaining payload for retry")
                pendingSyncPayload = payload
                persistState()
            }
        } catch (e: Exception) {
            Log.e(TAG, "performSync — network error: ${e.message}", e)
            pendingSyncPayload = payload
            persistState()
        }
    }

    // ── Midnight Reset ────────────────────────────────────────────────────────

    /**
     * Detects date changes on service start and triggers appropriate reset logic.
     * If storedDate is empty, initializes it to today.
     * If storedDate != today, handles the date change (including multi-day gaps).
     */
    private fun handleDateChangeOnStart() {
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        if (storedDate.isEmpty()) {
            // First-time start — initialize storedDate to today
            storedDate = today
            persistState()
            Log.d(TAG, "handleDateChangeOnStart — initialized storedDate to $today")
            return
        }

        if (storedDate != today) {
            Log.d(TAG, "handleDateChangeOnStart — date changed from $storedDate to $today")
            handleMultiDayGap(storedDate, today)
        }
    }

    /**
     * Handles the case where one or more days have elapsed since the stored date.
     * Persists the stored date's steps, records zero for intermediate days, then resets.
     */
    private fun handleMultiDayGap(fromDate: String, toDate: String) {
        val from = LocalDate.parse(fromDate, DateTimeFormatter.ISO_LOCAL_DATE)
        val to = LocalDate.parse(toDate, DateTimeFormatter.ISO_LOCAL_DATE)

        // Persist the stored date's final step count
        val finalSteps = dailySteps + rebootOffset
        persistStepHistory(fromDate, finalSteps)
        Log.d(TAG, "handleMultiDayGap — persisted $finalSteps steps for $fromDate")

        // Record zero for intermediate days (days between from and to, exclusive)
        var current = from.plusDays(1)
        while (current.isBefore(to)) {
            val intermediateDate = current.format(DateTimeFormatter.ISO_LOCAL_DATE)
            persistStepHistory(intermediateDate, 0)
            Log.d(TAG, "handleMultiDayGap — recorded 0 steps for intermediate day $intermediateDate")
            current = current.plusDays(1)
        }

        // Reset for the current day
        performMidnightReset()
    }

    /**
     * Performs the midnight reset:
     * - Resets dailySteps to 0
     * - Resets rebootOffset to 0
     * - Sets baseline to the last known cumulative sensor value
     * - Updates storedDate to today's date
     * - Persists the new state
     * - Schedules the next midnight alarm
     *
     * Note: The caller is responsible for persisting the previous day's steps
     * before calling this method (see handleMultiDayGap or direct callers).
     */
    private fun performMidnightReset() {
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        val previousDate = storedDate
        val previousSteps = dailySteps
        
        // Record reset timestamp for the JS update gate
        lastMidnightResetTime = System.currentTimeMillis()

        Log.d(TAG, """
            ════════════════════════════════════════════════════════════════
            🌙 MIDNIGHT_RESET: Starting midnight reset
            ════════════════════════════════════════════════════════════════
            Previous date: $previousDate
            New date: $today
            Steps yesterday: $previousSteps
            Previous baseline: $baseline
            Previous rebootOffset: $rebootOffset
            Previous displayStepFloor: $displayStepFloor
            lastCumulative sensor value: $lastCumulative
            ════════════════════════════════════════════════════════════════
        """.trimIndent())

        dailySteps = 0
        rebootOffset = 0
        displayStepFloor = 0  // FIX: Reset display floor at midnight so notification shows 0
        // Set baseline to last known cumulative sensor value.
        // If no sensor event has been received yet (lastCumulative == 0),
        // reset baseline to 0 so the first sensor event reinitializes it
        // to the current cumulative. This prevents the old baseline from
        // persisting across midnight and inflating next day's step count.
        if (lastCumulative > 0L) {
            baseline = lastCumulative
        } else {
            baseline = 0L
            hasReceivedFirstEvent = false // Force reinitialization on next event
        }
        storedDate = today
        debugLog(this, "MIDNIGHT_RESET: baseline=$baseline, lastCum=$lastCumulative, date=$today")

        // Update live step count immediately so JS reads 0 right after midnight
        liveStepCount = 0

        // Reset display floor so notification/widget show 0 until new data arrives
        displayStepFloor = 0

        persistState()
        scheduleMidnightAlarm()

        // One-time cleanup of step records this app wrote to Health Connect in
        // older builds. Reading our own records back was what inflated the count.
        // The service no longer writes to Health Connect at all, so once this has
        // run there is nothing left to delete — hence the one-shot flag instead of
        // a full 2-day Health Connect read on every midnight reset, forever.
        cleanupOwnHealthConnectRecordsOnce()

        // Emit step update event to JS so the UI resets to 0 immediately
        NativeStepModule.emitStepUpdate(0, forceEmit = true)

        // Update notification and widget to show 0 steps.
        // force = true so the throttle can't defer the midnight reset.
        lastNotifiedSteps = -1
        lastWidgetSteps = -1
        maybeUpdateNotification(force = true)
        updateWidget(force = true)

        Log.d(TAG, """
            ════════════════════════════════════════════════════════════════
            ✅ MIDNIGHT_RESET: Reset complete
            ════════════════════════════════════════════════════════════════
            New date: $today
            New baseline: $baseline
            Daily steps: 0
            Reboot offset: 0
            Display floor: 0
            Live step count: 0
            JS gate active: Next 120 seconds (blocks JS updates > 50 steps)
            Notification: Updated to 0
            Widget: Updated to 0
            JS event: Emitted (steps=0)
            ════════════════════════════════════════════════════════════════
        """.trimIndent())
    }

    /**
     * Deletes step records previously written to Health Connect by this app.
     * Runs at most once per install (guarded by the "ownHcRecordsPurged" flag).
     */
    private fun cleanupOwnHealthConnectRecordsOnce() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        if (prefs.getBoolean("ownHcRecordsPurged", false)) return

        serviceScope.launch {
            try {
                val status = HealthConnectClient.getSdkStatus(this@StepCounterService)
                if (status == HealthConnectClient.SDK_AVAILABLE) {
                    val client = HealthConnectClient.getOrCreate(this@StepCounterService)
                    val zone = ZoneId.systemDefault()
                    // Delete yesterday's records (they're the ones that could bleed)
                    val yesterday = LocalDate.now(zone).minusDays(1)
                    val yesterdayStart = yesterday.atStartOfDay(zone).toInstant()
                    val nowInstant = Instant.now()

                    // Delete our own records from yesterday AND today
                    val allRecords = client.readRecords(
                        ReadRecordsRequest(
                            StepsRecord::class,
                            TimeRangeFilter.between(yesterdayStart, nowInstant)
                        )
                    ).records.filter {
                        it.metadata.dataOrigin.packageName == packageName
                    }

                    if (allRecords.isNotEmpty()) {
                        val ids = allRecords.map { it.metadata.id }
                        client.deleteRecords(StepsRecord::class, ids, emptyList())
                        Log.d(TAG, "HC cleanup — deleted ${ids.size} own step records")
                    }
                    prefs.edit().putBoolean("ownHcRecordsPurged", true).apply()
                }
            } catch (e: Exception) {
                // Leave the flag unset so the cleanup is retried on the next reset.
                Log.w(TAG, "HC cleanup failed: ${e.message}")
            }
        }
    }

    /**
     * Persists a step count record for a given date into the step history JSON array.
     * History is stored in SharedPreferences as a JSON array of objects:
     * [{"date": "2025-01-15", "steps": 8432}, ...]
     */
    private fun persistStepHistory(date: String, steps: Int) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val historyJson = prefs.getString(STEP_HISTORY_KEY, "[]") ?: "[]"
        val existing = try {
            JSONArray(historyJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse step history JSON, starting fresh", e)
            JSONArray()
        }

        // Merge by date, keeping the highest count seen for that date.
        //
        // This used to be a bare append with no de-duplication and no cap. The same
        // date could be written several times (handleMultiDayGap re-records
        // intermediate days, and a flip-flopping storedDate re-runs the midnight
        // path), and the array grew forever. It is stored as one JSON string in
        // SharedPreferences, which is parsed into memory in full on first access.
        val byDate = LinkedHashMap<String, Int>()
        for (i in 0 until existing.length()) {
            val entry = existing.optJSONObject(i) ?: continue
            val entryDate = entry.optString("date", "")
            if (entryDate.isEmpty()) continue
            val entrySteps = entry.optInt("steps", 0)
            byDate[entryDate] = maxOf(byDate[entryDate] ?: 0, entrySteps)
        }
        byDate[date] = maxOf(byDate[date] ?: 0, maxOf(0, steps))

        // Keep the most recent MAX_HISTORY_DAYS days (ISO dates sort chronologically).
        val trimmed = byDate.entries
            .sortedBy { it.key }
            .takeLast(MAX_HISTORY_DAYS)

        val result = JSONArray()
        for ((entryDate, entrySteps) in trimmed) {
            result.put(JSONObject().apply {
                put("date", entryDate)
                put("steps", entrySteps)
            })
        }

        prefs.edit()
            .putString(STEP_HISTORY_KEY, result.toString())
            .apply()

        Log.d(TAG, "persistStepHistory — saved $steps steps for $date (records: ${result.length()})")
    }

    // ── Midnight Alarm Scheduling ─────────────────────────────────────────────

    /**
     * Schedules an exact AlarmManager alarm targeting the next occurrence of
     * midnight (00:00:00) local time as a fallback reset trigger.
     * Uses setExactAndAllowWhileIdle for precise midnight reset on OEM-aggressive
     * devices (Xiaomi, Samsung, Huawei) where inexact alarms can be delayed 15+ min.
     *
     * Falls back to setAndAllowWhileIdle if exact alarm permission is not granted
     * (Android 12+ requires SCHEDULE_EXACT_ALARM or USE_EXACT_ALARM).
     */
    private fun scheduleMidnightAlarm() {
        MidnightAlarmScheduler.schedule(this)
    }

    // ── Notification ─────────────────────────────────────────────────────────

    /**
     * Updates the foreground notification with the current step count.
     * Throttled to at most once every 5 seconds to avoid excessive notification
     * updates which could drain battery or cause visual flickering.
     */
    /**
     * The step count that should be shown on the notification and widget.
     *
     * The highest of:
     *  - dailySteps: the hardware sensor count
     *  - lastHcPollSteps: the Health Connect fallback (used when the sensor is
     *    silent or absent, where dailySteps stays 0)
     *  - displayStepFloor: pushed from JS, which additionally includes the server
     *    baseline and cross-device offset
     */
    private fun currentDisplaySteps(): Int =
        maxOf(dailySteps, maxOf(lastHcPollSteps, 0), displayStepFloor)

    private fun maybeUpdateNotification(force: Boolean = false) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return

        val displaySteps = currentDisplaySteps()

        // Throttle. This method was documented as "throttled to at most once every
        // 5 seconds" but never actually checked lastNotificationUpdateTime, so it
        // posted a notification on every sensor event. Android 13+ rate-limits
        // notification posts per package and starts dropping them, which froze the
        // notification on a stale count while the sensor kept counting.
        val now = System.currentTimeMillis()
        if (!force) {
            if (displaySteps == lastNotifiedSteps) return
            if (now - lastNotificationUpdateTime < NOTIFICATION_THROTTLE_MS) return
        }
        lastNotificationUpdateTime = now
        lastNotifiedSteps = displaySteps

        try {
            nm.notify(NOTIF_ID, buildStepNotification(displaySteps))
        } catch (e: Exception) {
            Log.w(TAG, "notify failed: ${e.message}")
        }
    }

    // ── Event Emission ──────────────────────────────────────────────────────

    /**
     * Emits a step update event to the React Native JavaScript layer (throttled).
     * Delegates to NativeStepModule.emitStepUpdate() which enforces the 5-second throttle.
     */
    private fun maybeEmitEvent() {
        // Emit the RAW hardware sensor step count to the JS layer.
        // The JS layer applies its own server baseline logic (additive mode) to
        // compute the correct combined total. Previously this emitted
        // max(dailySteps, displayStepFloor) which masked real step increments
        // and prevented live updates from working after server data loaded.
        // Notification and widget still use displayStepFloor separately.
        NativeStepModule.emitStepUpdate(dailySteps)
    }

    // ── Widget Update ─────────────────────────────────────────────────────────

    /**
     * Writes the current step count and goal to StepsWidgetPrefs SharedPreferences
     * and sends an ACTION_APPWIDGET_UPDATE broadcast to StepsWidgetProvider.
     * Broadcast failures are swallowed silently (non-fatal).
     */
    private fun updateWidget(force: Boolean = false) {
        val displaySteps = currentDisplaySteps()

        // Throttle. This previously ran a SharedPreferences commit AND a
        // sendBroadcast() on every sensor event. Android 13+ throttles background
        // broadcasts per package, so the widget updates were being dropped and the
        // constant binder/disk traffic made OEM ROMs more likely to kill the app.
        val now = System.currentTimeMillis()
        if (!force) {
            if (displaySteps == lastWidgetSteps) return
            if (now - lastWidgetUpdateTime < WIDGET_THROTTLE_MS) return
        }
        lastWidgetUpdateTime = now
        lastWidgetSteps = displaySteps

        val widgetPrefs = getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val goal = widgetPrefs.getInt("goal", 10000)
        widgetPrefs.edit()
            .putInt("steps", displaySteps)
            .putInt("goal", goal)
            .putLong("lastUpdated", System.currentTimeMillis())
            .apply()

        // Send broadcast to update widget instances
        try {
            val intent = Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
            intent.component = ComponentName(this, StepsWidgetProvider::class.java)
            val appWidgetManager = AppWidgetManager.getInstance(this)
            val ids = appWidgetManager.getAppWidgetIds(intent.component)
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            sendBroadcast(intent)
        } catch (e: Exception) {
            // Swallow broadcast failures silently — widget update is non-fatal
        }
    }

    // ── Health Connect Polling (fallback source) ─────────────────────────────

    /**
     * Polls Health Connect for today's steps and updates the notification.
     * Used when the native sensor is unavailable (HC-only devices, API 34+).
     * Replicates the single-source deduplication logic from the former
     * StepNotificationService to avoid inflated counts from multiple apps.
     */
    private fun pollHealthConnectAndUpdateNotification() {
        // Check midnight reset state first
        val stepPrefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val storedDateVal = stepPrefs.getString("storedDate", "") ?: ""
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        if (storedDateVal.isNotEmpty() && storedDateVal != today) {
            // Midnight reset pending — show 0 on every surface.
            if (lastHcPollSteps != 0) {
                lastHcPollSteps = 0
                liveStepCount = 0
                dailySteps = 0
                displayStepFloor = 0
                lastNotifiedSteps = -1
                lastWidgetSteps = -1
                maybeUpdateNotification(force = true)
                updateWidget(force = true)
                NativeStepModule.emitStepUpdate(0, forceEmit = true)
                Log.d(TAG, "HC poll: reset to 0 (midnight reset pending)")
            }
            return
        }

        serviceScope.launch {
            try {
                val zone = ZoneId.systemDefault()
                val now = Instant.now()
                val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()

                val client = HealthConnectClient.getOrCreate(this@StepCounterService)

                // readRecords + single-source dedup — pick the highest-count source
                // (excluding our own package) to avoid inflation from multiple apps.
                val stepRecords = client.readRecords(
                    ReadRecordsRequest(
                        StepsRecord::class,
                        TimeRangeFilter.between(startOfDay, now),
                    )
                ).records

                val stepsByOrigin = stepRecords
                    .groupBy { it.metadata.dataOrigin.packageName }
                    .filterKeys { it != packageName }
                    .mapValues { (_, records) -> records.sumOf { it.count } }

                // Clamp: Health Connect can hold absurd totals if another app wrote
                // bad data, and this value feeds liveStepCount.
                val todaySteps = (stepsByOrigin.values.maxOrNull() ?: 0L)
                    .coerceIn(0L, MAX_SANE_DAILY_STEPS.toLong())
                    .toInt()

                // Fallback to widget cache if HC returns 0 (common early morning / after reboot)
                val widgetPrefs = getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
                val cachedSteps = widgetPrefs.getInt("steps", 0)
                val cachedLastUpdated = widgetPrefs.getLong("lastUpdated", 0)
                val isCachedFromToday = if (cachedLastUpdated > 0) {
                    val updateCal = java.util.Calendar.getInstance().apply { timeInMillis = cachedLastUpdated }
                    val nowCal = java.util.Calendar.getInstance()
                    updateCal.get(java.util.Calendar.DAY_OF_YEAR) == nowCal.get(java.util.Calendar.DAY_OF_YEAR) &&
                        updateCal.get(java.util.Calendar.YEAR) == nowCal.get(java.util.Calendar.YEAR)
                } else false
                val safeCachedSteps = if (isCachedFromToday) cachedSteps else 0
                val steps = if (todaySteps == 0 && safeCachedSteps > 0) safeCachedSteps else todaySteps

                if (steps != lastHcPollSteps) {
                    lastHcPollSteps = steps

                    // Health Connect is a FALLBACK, so it may only raise the live
                    // count, never lower it. Previously this assigned liveStepCount
                    // unconditionally, so while both the sensor and the HC poll were
                    // active they overwrote each other every 10 seconds and
                    // getCurrentSteps() bounced between two values — the count
                    // looked stuck or went backwards.
                    if (steps > dailySteps) {
                        liveStepCount = steps
                    }

                    val effective = maxOf(steps, dailySteps)
                    maybeUpdateNotification(force = true)
                    updateWidget()
                    // Emit the effective count to JS (not the floor-capped value) so
                    // the JS-side additive logic can compute the total correctly.
                    NativeStepModule.emitStepUpdate(effective)
                    Log.d(TAG, "HC poll: hc=$steps, native=$dailySteps, floor=$displayStepFloor, origins: $stepsByOrigin")
                }
            } catch (e: Exception) {
                // Health Connect permission denied or unavailable
                val isDenied = e is SecurityException || e.message?.contains("permission", ignoreCase = true) == true
                if (isDenied) {
                    Log.e(TAG, """
                        ════════════════════════════════════════════════════════════════
                        ❌ HC_PERMISSION_DENIED: Cannot read Health Connect data
                        ════════════════════════════════════════════════════════════════
                        Error: ${e.message}
                        Reason: Health Connect read permission not granted
                        Impact: Cannot read steps from Health Connect fallback
                        Action Required:
                          1. Open Health Connect app
                          2. Go to "App permissions" → "Athlofit"
                          3. Enable "Steps" read permission
                        Current mode: ${if (sensorManager != null) "Native sensor only" else "NO DATA SOURCE"}
                        ════════════════════════════════════════════════════════════════
                    """.trimIndent())
                    debugLog(this@StepCounterService, "HC_ERROR: Permission denied — grant HC permission")
                } else {
                    Log.w(TAG, """
                        ════════════════════════════════════════════════════════════════
                        ⚠️ HC_POLL_ERROR: Health Connect read failed
                        ════════════════════════════════════════════════════════════════
                        Error: ${e.message}
                        Error type: ${e.javaClass.simpleName}
                        Reason: Health Connect temporarily unavailable or data access error
                        Action: Using cached widget value if available
                        Next poll: In ${HC_POLL_INTERVAL_MS / 1000}s
                        ════════════════════════════════════════════════════════════════
                    """.trimIndent())
                }
                val widgetPrefs = getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
                val cachedSteps = widgetPrefs.getInt("steps", 0)
                if (cachedSteps != lastHcPollSteps) {
                    lastHcPollSteps = cachedSteps
                    liveStepCount = cachedSteps
                    val displaySteps = maxOf(cachedSteps, displayStepFloor)
                    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                    nm.notify(NOTIF_ID, buildStepNotification(displaySteps))
                }
            }
        }
    }

    // ── Notification Helpers ──────────────────────────────────────────────────

    /**
     * Creates the notification channel for the foreground service.
     * Reuses the existing "step_counter_live" channel with IMPORTANCE_LOW.
     */
    private fun createNotificationChannel() {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        ensureNotificationChannel(this, nm)
    }

    /**
     * Builds the foreground notification displaying step count, goal, percentage
     * and progress bar. Delegates to the shared companion builder so the service
     * and pushStepUpdate() can never drift apart.
     *
     * @param steps The current daily step count to display.
     */
    private fun buildStepNotification(steps: Int): Notification =
        buildNotification(this, steps)
}
