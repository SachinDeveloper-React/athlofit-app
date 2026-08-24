package com.athlofit

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * NativeStepModule
 *
 * React Native native module that bridges the Android step counting service
 * to the JavaScript layer. Registered as "NativeStep" in the module registry.
 *
 * Responsibilities:
 * - Start/stop the StepCounterService
 * - Query current daily step count from StepDataStore (SharedPreferences)
 * - Check hardware sensor availability
 * - Check permission status
 * - Resolve the active step source
 * - Emit throttled step update events to JS
 * - Emit service stopped and sensor unavailable events to JS
 *
 * On API >= 34, the native sensor service still runs for real-time step
 * counting (notification, widget, app UI all use the live count). Health
 * Connect remains the source for sync/history.
 */
class NativeStepModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "NativeStepModule"
        private const val PREFS_NAME = "StepCounterPrefs"

        // Event names
        const val EVENT_STEP_UPDATE = "onStepUpdate"
        const val EVENT_SERVICE_STOPPED = "onServiceStopped"
        const val EVENT_SENSOR_UNAVAILABLE = "onSensorUnavailable"

        // Throttle interval for step update events (5 seconds)
        private const val EVENT_THROTTLE_MS = 5_000L

        /**
         * Static reference to the ReactApplicationContext for event emission
         * from StepCounterService (which doesn't hold a React context directly).
         */
        @Volatile
        var reactContextRef: ReactApplicationContext? = null
            private set

        /** Timestamp of last emitted step update event. */
        @Volatile
        private var lastEmitTime: Long = 0L

        /**
         * Emits a throttled "onStepUpdate" event to the JavaScript layer.
         * Called from StepCounterService when the step count changes.
         * Throttled to emit at most once per 5 seconds.
         *
         * @param steps The current daily step count.
         * @param forceEmit If true, bypasses the throttle (used for midnight reset).
         */
        fun emitStepUpdate(steps: Int, forceEmit: Boolean = false) {
            val now = System.currentTimeMillis()
            if (!forceEmit && now - lastEmitTime < EVENT_THROTTLE_MS) return
            lastEmitTime = now

            val context = reactContextRef ?: return
            if (!context.hasActiveReactInstance()) return

            val params = Arguments.createMap().apply {
                putInt("steps", steps)
            }

            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_STEP_UPDATE, params)
        }

        /**
         * Emits an "onServiceStopped" event to the JavaScript layer.
         * Called when the StepCounterService is stopped or terminated.
         */
        fun emitServiceStopped() {
            val context = reactContextRef ?: return
            if (!context.hasActiveReactInstance()) return

            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_SERVICE_STOPPED, null)
        }

        /**
         * Emits an "onSensorUnavailable" event to the JavaScript layer.
         * Called when the hardware step sensor is not found on the device.
         */
        fun emitSensorUnavailable() {
            val context = reactContextRef ?: return
            if (!context.hasActiveReactInstance()) return

            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_SENSOR_UNAVAILABLE, null)
        }
    }

    init {
        // Store the React context reference for static event emission
        reactContextRef = reactContext
    }

    override fun getName(): String = "NativeStep"

    /**
     * Exposes supported event names as constants to the JavaScript layer.
     */
    override fun getConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "STEP_UPDATE_EVENT" to EVENT_STEP_UPDATE,
            "SERVICE_STOPPED_EVENT" to EVENT_SERVICE_STOPPED,
            "SENSOR_UNAVAILABLE_EVENT" to EVENT_SENSOR_UNAVAILABLE
        )
    }

    // ─── Lifecycle Methods ────────────────────────────────────────────────────

    /**
     * Starts the step counting service.
     *
     * - Checks hardware sensor availability — if TYPE_STEP_COUNTER not present, rejects
     * - Checks StepPermissionManager — if permission needed and not granted, rejects
     * - Starts StepCounterService and resolves with true
     *
     * Note: On API >= 34, Health Connect is the official step source for sync/history,
     * but we still start the native sensor service for real-time step counting so the
     * notification, widget, and app UI all show the same live value.
     */
    @ReactMethod
    fun start(promise: Promise) {
        try {
            val context = reactApplicationContext

            // Check if hardware step counter sensor exists
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            if (sensorManager == null || sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) == null) {
                promise.reject(
                    "SENSOR_UNAVAILABLE",
                    "Hardware TYPE_STEP_COUNTER sensor is not available on this device."
                )
                return
            }

            // Check permission
            if (StepPermissionManager.needsPermission() && !StepPermissionManager.isGranted(context)) {
                promise.reject(
                    "PERMISSION_DENIED",
                    "ACTIVITY_RECOGNITION permission is required but not granted."
                )
                return
            }

            // Refuse when an admin has paused step tracking for this account.
            // Checked before scheduling as well as before starting: the
            // keep-alive worker exists precisely to bring the service back, so
            // scheduling it here would undo the pause a few minutes later.
            if (!StepTrackingGate.isEnabled(context)) {
                StepTrackingGate.stopEverything(context)
                promise.resolve(false)
                return
            }

            // Start the foreground service
            StepCounterService.start(context)
            // Schedule periodic keepalive worker to restart service if killed by OEM
            StepServiceScheduler.schedule(context)
            // Schedule periodic midnight reset check as a reliable backup
            MidnightResetWorker.enqueue(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("START_ERROR", e.message, e)
        }
    }

    /**
     * Stops the step counting service.
     * Resolves with true upon successful stop.
     */
    @ReactMethod
    fun stop(promise: Promise) {
        try {
            StepCounterService.stop(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STOP_ERROR", e.message, e)
        }
    }

    /**
     * Mirrors the server's per-user step-tracking kill switch into native
     * SharedPreferences, and stops every native step producer when disabled.
     *
     * JS cannot enforce this on its own. The foreground service and the two
     * WorkManager jobs are restarted by the OS on boot, after a task-kill, and
     * on their keep-alive schedule — all without any React context — so the
     * flag has to live somewhere the native side can read on its own.
     *
     * Re-enabling only clears the flag here; JS restarts the service via
     * start(), which owns the ACTIVITY_RECOGNITION permission flow.
     */
    @ReactMethod
    fun setStepTrackingEnabled(enabled: Boolean, reason: String?, promise: Promise) {
        try {
            StepTrackingGate.setEnabled(reactApplicationContext, enabled, reason)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STEP_TRACKING_TOGGLE_ERROR", e.message, e)
        }
    }

    /**
     * Records that the server has barred the running BUILD from submitting
     * steps, and stops every native step producer.
     *
     * Separate from setStepTrackingEnabled because the two states lift
     * differently: an account pause is cleared by an admin and mirrored down
     * from the profile fetch, whereas a build block is cleared only by
     * installing an update. Routing a build block through the account flag
     * would leave the device disabled after the user updated, until the next
     * successful profile fetch happened to clear it.
     */
    @ReactMethod
    fun setStepVersionBlocked(reason: String?, promise: Promise) {
        try {
            StepTrackingGate.setVersionBlocked(reactApplicationContext, reason)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STEP_VERSION_BLOCK_ERROR", e.message, e)
        }
    }

    /**
     * Reads the native-side kill-switch state. Useful when JS storage was
     * cleared but the native flag survives (or vice versa) — the two are
     * written independently and the app should trust "disabled" from either.
     */
    @ReactMethod
    fun isStepTrackingEnabled(promise: Promise) {
        try {
            val map = com.facebook.react.bridge.Arguments.createMap().apply {
                putBoolean("enabled", StepTrackingGate.isEnabled(reactApplicationContext))
                putString("reason", StepTrackingGate.reason(reactApplicationContext))
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("STEP_TRACKING_READ_ERROR", e.message, e)
        }
    }

    // ─── Query Methods ────────────────────────────────────────────────────────

    /**
     * Returns the current daily step count.
     * First tries the live in-memory value from StepCounterService (updated on every sensor event).
     * Falls back to SharedPreferences if the service is not running.
     * Returns 0 if no data has been recorded for the current day.
     *
     * Also triggers a sensor flush to ensure pending batched events are delivered,
     * which helps on budget devices that don't respect MAX_REPORT_LATENCY.
     */
    @ReactMethod
    fun getCurrentSteps(promise: Promise) {
        try {
            val today = java.time.LocalDate.now().format(
                java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
            )

            // Check if the service's stored date matches today.
            // If not, the midnight reset hasn't fired yet — return 0 to prevent
            // showing yesterday's steps after midnight.
            val prefs = reactApplicationContext.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
            )
            val storedDate = prefs.getString("storedDate", "") ?: ""
            if (storedDate.isNotEmpty() && storedDate != today) {
                // Midnight reset pending — return 0 instead of stale liveStepCount
                promise.resolve(0)
                return
            }

            // Trigger a sensor flush so any batched events are delivered before
            // we return the current value. Helps on Mediatek/budget devices.
            StepCounterService.requestFlush()

            // Prefer live in-memory value (updates instantly on every sensor event).
            val liveSteps = StepCounterService.liveStepCount
            if (liveSteps >= 0) {
                promise.resolve(liveSteps)
                return
            }

            // Fallback to SharedPreferences (service not running)
            // storedDate already checked above, so we know it's today
            val steps = prefs.getInt("dailySteps", 0)
            // Ensure non-negative
            promise.resolve(if (steps < 0) 0 else steps)
        } catch (e: Exception) {
            promise.reject("GET_STEPS_ERROR", e.message, e)
        }
    }

    /**
     * Checks whether the hardware TYPE_STEP_COUNTER sensor is available on the device.
     */
    /**
     * Returns the debug log from StepCounterService for production debugging.
     */
    @ReactMethod
    fun getStepDebugLog(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val log = prefs.getString("stepDebugLog", "(no logs)") ?: "(no logs)"
            promise.resolve(log)
        } catch (e: Exception) {
            promise.resolve("Error: ${e.message}")
        }
    }

    /**
     * Checks whether the hardware TYPE_STEP_COUNTER sensor is available on the device.
     * Returns true if the sensor is present, false otherwise.
     */
    @ReactMethod
    fun isSensorAvailable(promise: Promise) {
        try {
            val sensorManager = reactApplicationContext.getSystemService(
                Context.SENSOR_SERVICE
            ) as? SensorManager

            if (sensorManager == null) {
                promise.resolve(false)
                return
            }

            val stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            promise.resolve(stepSensor != null)
        } catch (e: Exception) {
            promise.reject("SENSOR_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Returns the current ACTIVITY_RECOGNITION permission status.
     * Returns: "granted", "denied", or "not_required" (for devices below API 29).
     */
    @ReactMethod
    fun getPermissionStatus(promise: Promise) {
        try {
            val status = StepPermissionManager.getStatus(reactApplicationContext)
            promise.resolve(status)
        } catch (e: Exception) {
            promise.reject("PERMISSION_STATUS_ERROR", e.message, e)
        }
    }

    /**
     * Requests the ACTIVITY_RECOGNITION permission (Android 10+).
     * Resolves with true if granted, false if denied.
     * On API < 29, resolves with true immediately (no permission needed).
     */
    @ReactMethod
    fun requestPermission(promise: Promise) {
        try {
            if (!StepPermissionManager.needsPermission()) {
                promise.resolve(true)
                return
            }

            if (StepPermissionManager.isGranted(reactApplicationContext)) {
                promise.resolve(true)
                return
            }

            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No current activity available to request permission")
                return
            }

            StepPermissionManager.requestPermission(activity as android.app.Activity) { granted ->
                promise.resolve(granted)
            }
        } catch (e: Exception) {
            promise.reject("PERMISSION_REQUEST_ERROR", e.message, e)
        }
    }

    /**
     * Returns the active step data source for the current device.
     * Returns: "health_connect", "native_sensor", or "unavailable".
     */
    @ReactMethod
    fun getActiveSource(promise: Promise) {
        try {
            val source = StepSourceResolver.resolve(reactApplicationContext)
            val sourceString = when (source) {
                StepSourceResolver.Source.HEALTH_CONNECT -> "health_connect"
                StepSourceResolver.Source.NATIVE_SENSOR -> "native_sensor"
                StepSourceResolver.Source.UNAVAILABLE -> "unavailable"
            }
            promise.resolve(sourceString)
        } catch (e: Exception) {
            promise.reject("SOURCE_ERROR", e.message, e)
        }
    }

    /**
     * Triggers a midnight reset from the JS layer.
     * Called when the JS midnight timer fires to ensure the native service
     * resets even if the AlarmManager alarm was delayed by Doze/battery optimization.
     * This restarts the service with the EXTRA_MIDNIGHT_RESET flag.
     */
    @ReactMethod
    fun triggerMidnightReset(promise: Promise) {
        try {
            val context = reactApplicationContext
            val serviceIntent = android.content.Intent(context, StepCounterService::class.java).apply {
                putExtra(MidnightResetReceiver.EXTRA_MIDNIGHT_RESET, true)
            }
            context.startForegroundService(serviceIntent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "triggerMidnightReset failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    /**
     * Forces an immediate update of the notification and widget with the given step count.
     * Called from JS when the app comes to foreground and has a fresher step count
     * (e.g., from Health Connect) than what the native sensor has accumulated.
     *
     * Only updates if the provided steps are higher than the current live value,
     * preventing stale data from overwriting real-time sensor data.
     *
     * This solves the notification/widget delay issue: when the app reads 6000 steps
     * from Health Connect but the notification still shows 5500 (because the sensor
     * hasn't delivered new events), calling this method immediately propagates 6000
     * to all surfaces.
     *
     * @param steps The fresh step count from Health Connect or server.
     */
    @ReactMethod
    fun forceRefreshSteps(steps: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            val applied = StepCounterService.pushStepUpdate(steps, context)
            Log.d(TAG, "forceRefreshSteps — steps=$steps, applied=$applied")
            promise.resolve(applied)
        } catch (e: Exception) {
            Log.e(TAG, "forceRefreshSteps failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    /**
     * Sets a server step floor for the native service.
     * After re-login, the server may have more steps for today than Health Connect
     * or the native sensor can see (e.g., steps walked on another device, or HC
     * data was cleared). This ensures the notification and widget never show fewer
     * steps than what the server has already recorded.
     *
     * If serverSteps > current native dailySteps, the difference is added to
     * rebootOffset so all subsequent sensor calculations include it.
     */
    @ReactMethod
    fun setServerStepFloor(serverSteps: Int, promise: Promise) {
        // FIX: Disabled. This function injected large values into rebootOffset
        // which caused permanent step inflation. Cross-device continuity is now
        // handled entirely by the JS layer (stepOffset.service.ts + server baseline).
        // The native service should only report actual hardware sensor steps.
        Log.d(TAG, "setServerStepFloor — DISABLED (inflation fix). serverSteps=$serverSteps ignored.")
        promise.resolve(false)
    }

    /**
     * Corrects inflated step count caused by the circular write bug.
     * If the native service's dailySteps is significantly higher than the actual
     * Health Connect platform sensor reading, reset the inflated rebootOffset
     * so the native service reports the correct value.
     *
     * @param correctSteps The actual correct step count (from HC platform sensor)
     */
    @ReactMethod
    fun correctInflatedSteps(correctSteps: Int, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val today = java.time.LocalDate.now().format(
                java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
            )

            val storedDate = prefs.getString("storedDate", "") ?: ""
            if (storedDate != today) {
                Log.d(TAG, "correctInflatedSteps — storedDate=$storedDate != today, skipping")
                promise.resolve(false)
                return
            }

            val currentDailySteps = prefs.getInt("dailySteps", 0)

            // Only correct if current is more than 2x the correct value
            if (correctSteps > 0 && currentDailySteps > correctSteps * 2) {
                val excessOffset = currentDailySteps - correctSteps
                val currentOffset = prefs.getInt("rebootOffset", 0)
                val newOffset = Math.max(0, currentOffset - excessOffset)

                prefs.edit()
                    .putInt("rebootOffset", newOffset)
                    .putInt("dailySteps", correctSteps)
                    .apply()

                // Update live count immediately
                StepCounterService.setLiveStepCountCorrected(correctSteps)

                // Bring the notification/widget floor down with it. Without this the
                // corrected count applies only inside the app, while the notification
                // and widget keep displaying the inflated total via
                // currentDisplaySteps() = max(dailySteps, ..., displayStepFloor).
                StepCounterService.resetDisplayFloor(correctSteps)

                // Restart the service so it reloads corrected values from SharedPrefs.
                // Without this, the running service's in-memory dailySteps/rebootOffset
                // remain inflated, and the next onSensorChanged would re-inflate liveStepCount.
                StepCounterService.start(context)

                Log.d(TAG, "correctInflatedSteps — corrected from $currentDailySteps to $correctSteps (removed offset: $excessOffset), service restarted")
                promise.resolve(true)
            } else {
                Log.d(TAG, "correctInflatedSteps — no correction needed (daily=$currentDailySteps, correct=$correctSteps)")
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "correctInflatedSteps failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    // ─── Battery Optimization ─────────────────────────────────────────────────

    /**
     * Checks if the app is exempt from battery optimization (Doze mode).
     * Returns true if the app is already whitelisted, false otherwise.
     */
    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            val context = reactApplicationContext
            val pm = context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
            if (pm == null) {
                promise.resolve(true) // Can't check — assume OK
                return
            }
            promise.resolve(pm.isIgnoringBatteryOptimizations(context.packageName))
        } catch (e: Exception) {
            Log.e(TAG, "isIgnoringBatteryOptimizations failed: ${e.message}", e)
            promise.resolve(true) // Fail safe — don't nag user
        }
    }

    /**
     * Opens the system dialog to request battery optimization exemption.
     * This shows a system-level prompt (not a custom UI) asking the user to
     * allow the app to run unrestricted in the background.
     */
    @ReactMethod
    fun requestDisableBatteryOptimization(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
            ).apply {
                data = android.net.Uri.parse("package:${context.packageName}")
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "requestDisableBatteryOptimization failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    /**
     * Opens the app's battery settings page directly (manufacturer-specific).
     * Fallback when the direct dialog doesn't work on some OEMs.
     */
    @ReactMethod
    fun openBatterySettings(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
            ).apply {
                addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "openBatterySettings failed: ${e.message}", e)
            promise.resolve(false)
        }
    }

    // ─── Diagnostics ──────────────────────────────────────────────────────────

    /**
     * Returns comprehensive diagnostic information for debugging step counting issues.
     * Covers: device info, permission state, sensor availability, service status,
     * battery optimization, step state, and recent debug log.
     *
     * Designed for Android 10 (API 29) debugging where steps may not update.
     */
    @ReactMethod
    fun getDiagnostics(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val diag = Arguments.createMap()

            // ── Device Info ──
            val deviceInfo = Arguments.createMap().apply {
                putInt("apiLevel", Build.VERSION.SDK_INT)
                putString("androidVersion", Build.VERSION.RELEASE)
                putString("manufacturer", Build.MANUFACTURER)
                putString("model", Build.MODEL)
                putString("brand", Build.BRAND)
                putString("device", Build.DEVICE)
                putString("hardware", Build.HARDWARE)
                // Chipset info (helps identify Mediatek batching issues)
                putString("board", Build.BOARD)
                putString("soc", if (Build.VERSION.SDK_INT >= 31) Build.SOC_MODEL else "unknown (API<31)")
            }
            diag.putMap("device", deviceInfo)

            // ── Permission State ──
            val permInfo = Arguments.createMap().apply {
                putBoolean("activityRecognitionRequired", StepPermissionManager.needsPermission())
                putBoolean("activityRecognitionGranted", StepPermissionManager.isGranted(context))
                putString("permissionStatus", StepPermissionManager.getStatus(context))
                putInt("retryCount", StepPermissionManager.getRetryCount())
                putBoolean("retryExhausted", StepPermissionManager.isRetryExhausted())
            }
            diag.putMap("permission", permInfo)

            // ── Sensor Info ──
            val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            val stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            val stepDetector = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)
            val sensorInfo = Arguments.createMap().apply {
                putBoolean("sensorManagerAvailable", sensorManager != null)
                putBoolean("stepCounterAvailable", stepSensor != null)
                putBoolean("stepDetectorAvailable", stepDetector != null)
                if (stepSensor != null) {
                    putString("sensorName", stepSensor.name)
                    putString("sensorVendor", stepSensor.vendor)
                    putInt("sensorVersion", stepSensor.version)
                    putDouble("sensorMaxRange", stepSensor.maximumRange.toDouble())
                    putDouble("sensorResolution", stepSensor.resolution.toDouble())
                    putInt("sensorMinDelay", stepSensor.minDelay)
                    putInt("sensorMaxDelay", stepSensor.maxDelay)
                    putBoolean("isWakeUpSensor", stepSensor.isWakeUpSensor)
                    putInt("fifoMaxCount", stepSensor.fifoMaxEventCount)
                    putInt("fifoReservedCount", stepSensor.fifoReservedEventCount)
                }
            }
            diag.putMap("sensor", sensorInfo)

            // ── Service State ──
            val serviceInfo = Arguments.createMap().apply {
                putInt("liveStepCount", StepCounterService.liveStepCount)
                putBoolean("serviceRunning", StepCounterService.liveStepCount >= 0)
                putInt("displayStepFloor", StepCounterService.displayStepFloor)
                putString("source", StepSourceResolver.resolve(context).name)
                // Sensor event tracking (key for Android 10 silence detection)
                putDouble("lastSensorEventTime", StepCounterService.lastSensorEventTimeStatic.toDouble())
                putDouble("sensorEventCount", StepCounterService.sensorEventCountStatic.toDouble())
                val lastEvtMs = StepCounterService.lastSensorEventTimeStatic
                if (lastEvtMs > 0L) {
                    val silenceSec = (System.currentTimeMillis() - lastEvtMs) / 1000
                    putDouble("secondsSinceLastSensorEvent", silenceSec.toDouble())
                } else {
                    putDouble("secondsSinceLastSensorEvent", (-1).toDouble())
                }
                // ── Sensor health / fallback state ──
                // hcPollingMode true while the sensor is silent and Health Connect
                // is standing in. reregisterCount growing quickly means the sensor
                // listener is being torn down repeatedly, which starves event
                // delivery on sensor-hub devices.
                putBoolean("hcPollingMode", StepCounterService.hcPollingModeStatic)
                putBoolean("sensorSupportsFlush", StepCounterService.sensorSupportsFlushStatic)
                putBoolean("pollByReregisterMode", StepCounterService.pollByReregisterStatic)
                putInt("reregisterCount", StepCounterService.reregisterCountStatic)
            }
            diag.putMap("service", serviceInfo)

            // ── Persisted Step State ──
            val stateInfo = Arguments.createMap().apply {
                putDouble("baseline", prefs.getLong("baseline", 0L).toDouble())
                putInt("dailySteps", prefs.getInt("dailySteps", 0))
                putInt("rebootOffset", prefs.getInt("rebootOffset", 0))
                putString("storedDate", prefs.getString("storedDate", "") ?: "")
                putDouble("lastCumulative", prefs.getLong("lastCumulative", 0L).toDouble())
                putDouble("lastSyncTime", prefs.getLong("lastSyncTime", 0L).toDouble())
                putInt("lastSyncedSteps", prefs.getInt("lastSyncedSteps", -1))
                // Only V6 remains — the stacked V2/V4/V5 migrations were removed
                // because V6 already applies a strict superset of their resets.
                putBoolean("inflationFixV6", prefs.getBoolean("inflationFixV6", false))
                putBoolean("ownHcRecordsPurged", prefs.getBoolean("ownHcRecordsPurged", false))
            }
            diag.putMap("stepState", stateInfo)

            // ── Battery Optimization ──
            val pm = context.getSystemService(Context.POWER_SERVICE) as? android.os.PowerManager
            val batteryInfo = Arguments.createMap().apply {
                putBoolean("ignoringBatteryOptimization", pm?.isIgnoringBatteryOptimizations(context.packageName) ?: true)
                putBoolean("isDeviceIdleMode", pm?.isDeviceIdleMode ?: false)
                putBoolean("isPowerSaveMode", pm?.isPowerSaveMode ?: false)
            }
            diag.putMap("battery", batteryInfo)

            // ── Timestamp Info ──
            val now = System.currentTimeMillis()
            val timeInfo = Arguments.createMap().apply {
                putDouble("currentTimeMs", now.toDouble())
                putString("currentDate", java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE))
                putString("timezone", java.util.TimeZone.getDefault().id)
            }
            diag.putMap("time", timeInfo)

            // ── Debug Log (last 50 lines) ──
            val debugLog = prefs.getString("stepDebugLog", "(no logs)") ?: "(no logs)"
            diag.putString("debugLog", debugLog)

            promise.resolve(diag)
        } catch (e: Exception) {
            Log.e(TAG, "getDiagnostics failed: ${e.message}", e)
            promise.reject("DIAGNOSTICS_ERROR", e.message, e)
        }
    }
}
