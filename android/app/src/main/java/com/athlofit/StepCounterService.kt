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
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.metadata.Metadata
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
        // Use the same notification ID as StepNotificationService so only one
        // notification is visible. StepNotificationService handles the display;
        // this service just needs a foreground notification to stay alive.
        private const val NOTIF_ID = 1001
        private const val PREFS_NAME = "StepCounterPrefs"
        private const val WIDGET_PREFS_NAME = "StepsWidgetPrefs"
        private const val STEP_HISTORY_KEY = "stepHistory"

        // Max report latency for sensor batching (10 seconds as per requirement 9.3)
        private const val MAX_REPORT_LATENCY_US = 10_000_000 // 10 seconds in microseconds

        // Sync interval: 15 minutes in milliseconds (requirement 9.4)
        private const val SYNC_INTERVAL_MS = 15 * 60 * 1000L

        // Health Connect write interval: 30 seconds (keeps Samsung Health in sync)
        private const val HC_WRITE_INTERVAL_MS = 30 * 1000L

        /**
         * Live in-memory step count accessible from NativeStepModule.getCurrentSteps()
         * without waiting for the 90-second SharedPreferences persist cycle.
         * Returns -1 if the service is not running (caller should fall back to SharedPreferences).
         */
        @Volatile
        var liveStepCount: Int = -1
            private set

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
        fun pushStepUpdate(steps: Int, context: Context): Boolean {
            if (steps <= liveStepCount && liveStepCount >= 0) return false
            liveStepCount = steps

            // Update widget SharedPreferences
            val widgetPrefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
            val goal = widgetPrefs.getInt("goal", 10000)
            widgetPrefs.edit()
                .putInt("steps", steps)
                .putLong("lastUpdated", System.currentTimeMillis())
                .apply()

            // Update notification
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager
            if (nm != null) {
                val channel = android.app.NotificationChannel(
                    "step_counter_live",
                    "Live Step Counter",
                    android.app.NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Shows your live step count for today"
                    setShowBadge(false)
                }
                nm.createNotificationChannel(channel)

                val percentage = if (goal > 0) ((steps.toLong() * 100) / goal).toInt().coerceIn(0, 100) else 0
                val stepsFormatted = String.format("%,d", steps)
                val goalFormatted = String.format("%,d", goal)

                val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
                    flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                    putExtra("screen", "steps")
                }
                val pendingIntent = launchIntent?.let {
                    android.app.PendingIntent.getActivity(
                        context, 0, it,
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    )
                }

                val notification = androidx.core.app.NotificationCompat.Builder(context, "step_counter_live")
                    .setSmallIcon(R.drawable.ic_notification)
                    .setContentTitle("$stepsFormatted steps today")
                    .setContentText("Goal: $goalFormatted \u2022 $percentage% complete")
                    .setProgress(100, percentage, false)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setSilent(true)
                    .setVisibility(androidx.core.app.NotificationCompat.VISIBILITY_PUBLIC)
                    .setContentIntent(pendingIntent)
                    .build()

                nm.notify(1001, notification)
            }

            // Trigger widget refresh broadcast
            try {
                val appWidgetManager = android.appwidget.AppWidgetManager.getInstance(context)
                val componentName = android.content.ComponentName(context, StepsWidgetProvider::class.java)
                val ids = appWidgetManager.getAppWidgetIds(componentName)
                if (ids.isNotEmpty()) {
                    val intent = android.content.Intent(android.appwidget.AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
                        component = componentName
                        putExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
                    }
                    context.sendBroadcast(intent)
                }
            } catch (_: Exception) { /* non-fatal */ }

            return true
        }

        /**
         * Convenience method to start the service from any context.
         */
        fun start(context: Context) {
            val intent = Intent(context, StepCounterService::class.java)
            context.startForegroundService(intent)
        }

        /**
         * Convenience method to stop the service from any context.
         */
        fun stop(context: Context) {
            liveStepCount = -1
            context.stopService(Intent(context, StepCounterService::class.java))
        }
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

    /** Timestamp of last network sync. */
    private var lastSyncTime: Long = 0L

    /** Step count at the time of last successful sync (FIX #8: skip sync if unchanged). */
    private var lastSyncedSteps: Int = -1

    /** Unsent sync payload retained after a failed sync attempt. */
    private var pendingSyncPayload: String = ""

    /** Timestamp of last notification update. */
    private var lastNotificationUpdateTime: Long = 0L

    /** Timestamp of last JS event emission. */
    private var lastEventEmitTime: Long = 0L

    /** Whether we have received the first sensor event (used for baseline initialization). */
    private var hasReceivedFirstEvent: Boolean = false

    /** Last known cumulative sensor value (used for midnight reset baseline). */
    private var lastCumulative: Long = 0L

    /** Timestamp of last Health Connect write. */
    private var lastHcWriteTime: Long = 0L

    /** Last step count written to Health Connect (to avoid duplicate writes). */
    private var lastHcWrittenSteps: Int = 0

    /** Coroutine scope for Health Connect writes (requires suspend functions). */
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // ── System references ─────────────────────────────────────────────────────

    private var sensorManager: SensorManager? = null
    private var stepSensor: Sensor? = null

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "onStartCommand called")

        // Check if this is a midnight reset trigger from MidnightResetReceiver
        val isMidnightReset = intent?.getBooleanExtra(MidnightResetReceiver.EXTRA_MIDNIGHT_RESET, false) ?: false

        // Create notification channel and start as foreground service immediately
        createNotificationChannel()
        try {
            // Show cached steps so notification never displays zero while awaiting first sensor event
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val cachedSteps = prefs.getInt("dailySteps", 0)
            startForeground(NOTIF_ID, buildStepNotification(cachedSteps))
            lastNotificationUpdateTime = System.currentTimeMillis()
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed: ${e.message}", e)
            stopSelf()
            return START_NOT_STICKY
        }

        // Load persisted state
        loadPersistedState()

        // If triggered by midnight alarm and service was already running,
        // perform midnight reset directly for immediate effect
        if (isMidnightReset) {
            Log.d(TAG, "onStartCommand — midnight reset triggered via intent extra")
            val today = java.time.LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
            if (storedDate.isNotEmpty() && storedDate != today) {
                handleMultiDayGap(storedDate, today)
            } else {
                // storedDate already matches today (unlikely at midnight) — just reschedule
                scheduleMidnightAlarm()
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
                Log.e(TAG, "Failed to register sensor listener — stopping service")
                emitSensorFailure()
                stopSelf()
                return START_NOT_STICKY
            }
        }

        Log.d(TAG, "Service started — baseline=$baseline, dailySteps=$dailySteps, rebootOffset=$rebootOffset, storedDate=$storedDate")

        return START_STICKY
    }

    override fun onDestroy() {
        Log.d(TAG, "onDestroy — persisting state and unregistering sensor")
        // Persist current state before shutdown
        persistState()
        // Unregister sensor listener
        sensorManager?.unregisterListener(this)
        // Emit service stopped event to JS layer
        NativeStepModule.emitServiceStopped()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── Sensor Registration ───────────────────────────────────────────────────

    /**
     * Registers the TYPE_STEP_COUNTER sensor listener with SENSOR_DELAY_NORMAL
     * and a max report latency of 10 seconds.
     *
     * @return true if registration succeeded, false otherwise.
     */
    private fun registerSensorListener(): Boolean {
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        if (sensorManager == null) {
            Log.e(TAG, "SensorManager is null")
            return false
        }

        stepSensor = sensorManager!!.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (stepSensor == null) {
            Log.e(TAG, "TYPE_STEP_COUNTER sensor not available")
            return false
        }

        val success = sensorManager!!.registerListener(
            this,
            stepSensor,
            SensorManager.SENSOR_DELAY_NORMAL,
            MAX_REPORT_LATENCY_US
        )

        if (!success) {
            Log.e(TAG, "registerListener returned false")
        }

        return success
    }

    // ── SensorEventListener ───────────────────────────────────────────────────

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_STEP_COUNTER) return

        val cumulative = event.values[0].toLong()
        lastCumulative = cumulative

        // Check if the day has changed since last event — handles the case where
        // the midnight alarm fires late or doesn't fire at all (Doze mode).
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        if (storedDate.isNotEmpty() && storedDate != today) {
            Log.d(TAG, "onSensorChanged — day changed ($storedDate → $today), performing midnight reset")
            persistStepHistory(storedDate, dailySteps)
            performMidnightReset()
            // After reset, baseline is set to lastCumulative (which is 'cumulative' here)
            // so this event produces 0 steps — just return
            return
        }

        // First event after service start: initialize baseline if not already set
        if (!hasReceivedFirstEvent) {
            hasReceivedFirstEvent = true
            if (baseline == 0L) {
                // Fresh start — no persisted baseline, use current cumulative
                baseline = cumulative
                persistState()
                Log.d(TAG, "First event — initialized baseline to $cumulative")
                return
            }
        }

        // Delegate reboot detection and step calculation to pure function
        val state = StepState(baseline, dailySteps, rebootOffset, hasReceivedFirstEvent)
        val result = calculateSteps(state, cumulative)

        // Log reboot detection if it occurred
        if (result.rebootOffset != rebootOffset) {
            Log.d(TAG, "Reboot detected: cumulative=$cumulative < baseline=$baseline, dailySteps=$dailySteps")
        }

        // Apply result
        baseline = result.baseline
        dailySteps = result.dailySteps
        rebootOffset = result.rebootOffset

        // Update the live static step count so NativeStepModule.getCurrentSteps()
        // always returns the freshest value without waiting for SharedPreferences persist.
        liveStepCount = dailySteps

        // Stub calls for subsequent tasks to fill in
        maybePersist()
        maybeSync()
        maybeUpdateNotification()
        maybeEmitEvent()
        updateWidget()
        maybeWriteToHealthConnect()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // No action needed for step counter accuracy changes
    }

    // ── Persistence (stub — filled in by task 2.2) ────────────────────────────

    /**
     * Persists step data to SharedPreferences at intervals no greater than 90 seconds.
     * Only writes if at least 90 seconds have elapsed since the last persist.
     */
    private fun maybePersist() {
        val now = System.currentTimeMillis()
        if (now - lastPersistTime >= 90_000L) {
            persistState()
            lastPersistTime = now
        }
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
            // Seed from Health Connect if available (service starting fresh)
            seedFromHealthConnectIfNeeded()
            return
        }

        if (storedDate != today) {
            Log.d(TAG, "handleDateChangeOnStart — date changed from $storedDate to $today")
            handleMultiDayGap(storedDate, today)
            // After midnight reset, seed from Health Connect so steps accumulated
            // while the service was stopped are not lost.
            seedFromHealthConnectIfNeeded()
        }
    }

    /**
     * Queries Health Connect for today's accumulated steps and seeds the difference
     * into rebootOffset if HC reports more steps than the sensor has counted.
     * This handles the case where the service was killed/restarted and the user
     * walked steps that HC tracked but the sensor service missed (e.g., walking
     * before the app launched in the morning).
     *
     * The difference (hcSteps - dailySteps) is added to rebootOffset so the
     * calculateSteps formula (cumulative - baseline) + rebootOffset correctly
     * includes pre-service steps in all subsequent calculations.
     *
     * Runs on a background coroutine since Health Connect requires suspend calls.
     * Updates liveStepCount, notification, and widget once the seed value arrives.
     */
    private fun seedFromHealthConnectIfNeeded() {
        serviceScope.launch {
            try {
                val client = HealthConnectClient.getOrCreate(this@StepCounterService)
                val zone = ZoneId.systemDefault()
                val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()
                val now = Instant.now()

                // Always read from startOfDay to capture ALL steps walked today.
                // Previously filtered by loginTimestamp, but that caused mismatches:
                // after re-login, pre-login steps were excluded from the notification
                // and widget while the phone's built-in pedometer showed the full count.
                // The server handles anti-cheat validation independently.
                val stepsStart = startOfDay

                val stepRecords = client.readRecords(
                    ReadRecordsRequest(
                        StepsRecord::class,
                        TimeRangeFilter.between(stepsStart, now),
                    )
                ).records

                // Dedup by data origin — pick highest single source (same logic as notification)
                val stepsByOrigin = stepRecords
                    .groupBy { it.metadata.dataOrigin.packageName }
                    .mapValues { (_, records) -> records.sumOf { it.count } }

                val hcSteps = stepsByOrigin.values.maxOrNull()?.toInt() ?: 0

                if (hcSteps > dailySteps) {
                    // HC reports more steps than the sensor has counted since restart.
                    // The difference is steps accumulated before the service started
                    // (e.g., user walked before the app launched this morning).
                    // Store the difference as rebootOffset so the calculateSteps formula
                    // (cumulative - baseline) + rebootOffset preserves these steps
                    // when the next sensor event arrives. Without this, the sensor
                    // calculation would overwrite dailySteps with just the delta since
                    // baseline, losing all steps accumulated before the service started.
                    val missingSteps = hcSteps - dailySteps
                    Log.d(TAG, "seedFromHealthConnect — seeding offset of $missingSteps steps (HC=$hcSteps, sensor=$dailySteps)")
                    rebootOffset += missingSteps
                    dailySteps = hcSteps
                    liveStepCount = hcSteps
                    persistState()
                    // Update notification and widget immediately
                    maybeUpdateNotification()
                    updateWidget()
                    // Emit to JS so the app shows correct value
                    NativeStepModule.emitStepUpdate(hcSteps, forceEmit = true)
                } else {
                    Log.d(TAG, "seedFromHealthConnect — HC returned $hcSteps steps, dailySteps=$dailySteps, no seed needed")
                }
            } catch (e: Exception) {
                Log.w(TAG, "seedFromHealthConnect — failed: ${e.message}", e)
                // Non-fatal: service continues counting from 0, HC data will
                // show in the app via the normal useHealth flow.
            }
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

        dailySteps = 0
        rebootOffset = 0
        // Set baseline to last known cumulative sensor value
        // If no sensor event has been received yet, keep existing baseline
        if (lastCumulative > 0L) {
            baseline = lastCumulative
        }
        storedDate = today

        // Update live step count immediately so JS reads 0 right after midnight
        liveStepCount = 0

        persistState()
        scheduleMidnightAlarm()

        // Emit step update event to JS so the UI resets to 0 immediately
        NativeStepModule.emitStepUpdate(0, forceEmit = true)

        // Update notification and widget to show 0 steps
        maybeUpdateNotification()
        updateWidget()

        Log.d(TAG, "performMidnightReset — reset complete. baseline=$baseline, storedDate=$storedDate")
    }

    /**
     * Persists a step count record for a given date into the step history JSON array.
     * History is stored in SharedPreferences as a JSON array of objects:
     * [{"date": "2025-01-15", "steps": 8432}, ...]
     */
    private fun persistStepHistory(date: String, steps: Int) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val historyJson = prefs.getString(STEP_HISTORY_KEY, "[]") ?: "[]"
        val historyArray = try {
            JSONArray(historyJson)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse step history JSON, starting fresh", e)
            JSONArray()
        }

        val record = JSONObject().apply {
            put("date", date)
            put("steps", steps)
        }
        historyArray.put(record)

        prefs.edit()
            .putString(STEP_HISTORY_KEY, historyArray.toString())
            .apply()

        Log.d(TAG, "persistStepHistory — saved $steps steps for $date (total records: ${historyArray.length()})")
    }

    // ── Midnight Alarm Scheduling ─────────────────────────────────────────────

    /**
     * Schedules an exact AlarmManager alarm targeting the next occurrence of
     * midnight (00:00:01) local time as a fallback reset trigger.
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
    private fun maybeUpdateNotification() {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        nm.notify(NOTIF_ID, buildStepNotification(dailySteps))
    }

    // ── Event Emission ──────────────────────────────────────────────────────

    /**
     * Emits a step update event to the React Native JavaScript layer (throttled).
     * Delegates to NativeStepModule.emitStepUpdate() which enforces the 5-second throttle.
     */
    private fun maybeEmitEvent() {
        NativeStepModule.emitStepUpdate(dailySteps)
    }

    /**
     * Emits a sensor failure event to the React Native JavaScript layer.
     * Called when sensor listener registration fails.
     */
    private fun emitSensorFailure() {
        Log.e(TAG, "Sensor registration failed — emitting failure event")
        NativeStepModule.emitSensorUnavailable()
    }

    // ── Widget Update ─────────────────────────────────────────────────────────

    /**
     * Writes the current step count and goal to StepsWidgetPrefs SharedPreferences
     * and sends an ACTION_APPWIDGET_UPDATE broadcast to StepsWidgetProvider.
     * Broadcast failures are swallowed silently (non-fatal).
     */
    private fun updateWidget() {
        // Write current steps, goal, and timestamp to widget SharedPreferences
        val widgetPrefs = getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        val goal = widgetPrefs.getInt("goal", 10000)
        widgetPrefs.edit()
            .putInt("steps", dailySteps)
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

    // ── Health Connect Write ─────────────────────────────────────────────────

    /**
     * Writes the current daily step count to Health Connect as a StepsRecord.
     * Throttled to write at most once every 2 minutes and only when steps have changed.
     * Deletes previous records from this app for today before inserting to avoid duplication.
     */
    private fun maybeWriteToHealthConnect() {
        val now = System.currentTimeMillis()
        if (now - lastHcWriteTime < HC_WRITE_INTERVAL_MS) return
        if (dailySteps <= 0 || dailySteps == lastHcWrittenSteps) return

        lastHcWriteTime = now
        val stepsToWrite = dailySteps

        serviceScope.launch {
            try {
                // Check if Health Connect is available on this device
                val status = HealthConnectClient.getSdkStatus(this@StepCounterService)
                if (status != HealthConnectClient.SDK_AVAILABLE) {
                    Log.w(TAG, "Health Connect not available (status=$status) — skipping step write")
                    return@launch
                }

                val client = HealthConnectClient.getOrCreate(this@StepCounterService)
                val zone = ZoneId.systemDefault()
                val today = LocalDate.now(zone)
                val startOfDay = today.atStartOfDay(zone).toInstant()
                
                // Always write from startOfDay so the record is visible to all
                // step queries (app, widget, notification all read from startOfDay).
                val startTime = startOfDay
                val endTime = Instant.now()

                // startTime must be strictly before endTime
                if (!startTime.isBefore(endTime)) {
                    Log.w(TAG, "Skipping HC write — startTime is not before endTime")
                    return@launch
                }

                // Delete previous step records from THIS app for today to avoid duplication.
                try {
                    val timeRangeFilter = androidx.health.connect.client.time.TimeRangeFilter.between(startOfDay, endTime)
                    val existingRecords = client.readRecords(
                        androidx.health.connect.client.request.ReadRecordsRequest(
                            StepsRecord::class,
                            timeRangeFilter
                        )
                    ).records.filter {
                        it.metadata.dataOrigin.packageName == packageName
                    }
                    if (existingRecords.isNotEmpty()) {
                        val ids = existingRecords.map { it.metadata.id }
                        client.deleteRecords(StepsRecord::class, ids, emptyList())
                    }
                } catch (e: Exception) {
                    // Deletion failed — proceed with insert anyway
                    Log.w(TAG, "Failed to delete old HC step records: ${e.message}")
                }

                // Insert a single record with the current total
                val record = StepsRecord(
                    count = stepsToWrite.toLong(),
                    startTime = startTime,
                    startZoneOffset = zone.rules.getOffset(startTime),
                    endTime = endTime,
                    endZoneOffset = zone.rules.getOffset(endTime),
                )

                client.insertRecords(listOf(record))
                lastHcWrittenSteps = stepsToWrite
                Log.d(TAG, "Wrote $stepsToWrite steps to Health Connect (deleted old records first)")
            } catch (e: Exception) {
                Log.w(TAG, "Failed to write steps to Health Connect: ${e.message}", e)
            }
        }
    }

    // ── Notification Helpers ──────────────────────────────────────────────────

    /**
     * Creates the notification channel for the foreground service.
     * Reuses the existing "step_counter_live" channel with IMPORTANCE_LOW.
     */
    private fun createNotificationChannel() {
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
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(channel)
    }

    /**
     * Reads the daily step goal from StepsWidgetPrefs SharedPreferences.
     */
    private fun getDailyGoal(): Int {
        val widgetPrefs = getSharedPreferences(WIDGET_PREFS_NAME, Context.MODE_PRIVATE)
        return widgetPrefs.getInt("goal", 10000)
    }

    /**
     * Builds the foreground notification displaying step count, goal, percentage, and progress bar.
     *
     * @param steps The current daily step count to display.
     */
    private fun buildStepNotification(steps: Int): Notification {
        val goal = getDailyGoal()
        val percentage = if (goal > 0) ((steps.toLong() * 100) / goal).toInt().coerceIn(0, 100) else 0
        val stepsFormatted = String.format("%,d", steps)
        val goalFormatted = String.format("%,d", goal)

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            putExtra("screen", "steps")
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
            .setContentText("Goal: $goalFormatted \u2022 $percentage% complete")
            .setProgress(100, percentage, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingIntent)
            .build()
    }
}
