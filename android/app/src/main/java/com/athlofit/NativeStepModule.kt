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

            // Start the foreground service
            StepCounterService.start(context)
            // Schedule periodic keepalive worker to restart service if killed by OEM
            StepServiceScheduler.schedule(context)
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

    // ─── Query Methods ────────────────────────────────────────────────────────

    /**
     * Returns the current daily step count.
     * First tries the live in-memory value from StepCounterService (updated on every sensor event).
     * Falls back to SharedPreferences if the service is not running.
     * Returns 0 if no data has been recorded for the current day.
     */
    @ReactMethod
    fun getCurrentSteps(promise: Promise) {
        try {
            val today = java.time.LocalDate.now().format(
                java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
            )

            // Prefer live in-memory value (updates instantly on every sensor event)
            val liveSteps = StepCounterService.liveStepCount
            if (liveSteps >= 0) {
                promise.resolve(liveSteps)
                return
            }

            // Fallback to SharedPreferences (service not running)
            val prefs = reactApplicationContext.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
            )

            // Check if stored data is from today — if not, return 0
            val storedDate = prefs.getString("storedDate", "") ?: ""
            if (storedDate != today) {
                promise.resolve(0)
                return
            }

            val steps = prefs.getInt("dailySteps", 0)
            // Ensure non-negative
            promise.resolve(if (steps < 0) 0 else steps)
        } catch (e: Exception) {
            promise.reject("GET_STEPS_ERROR", e.message, e)
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
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val today = java.time.LocalDate.now().format(
                java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
            )

            // Get current native step count
            val liveSteps = StepCounterService.liveStepCount
            val currentSteps = if (liveSteps >= 0) liveSteps else {
                val storedDate = prefs.getString("storedDate", "") ?: ""
                if (storedDate == today) prefs.getInt("dailySteps", 0) else 0
            }

            if (serverSteps > currentSteps) {
                // The server has more steps — inject the difference into rebootOffset
                // so the native service (notification + widget) shows at least serverSteps.
                val deficit = serverSteps - currentSteps
                val currentOffset = prefs.getInt("rebootOffset", 0)
                prefs.edit()
                    .putInt("rebootOffset", currentOffset + deficit)
                    .putInt("dailySteps", serverSteps)
                    .apply()

                // Update live count if service is running
                if (liveSteps >= 0) {
                    // Restart service to pick up the new offset
                    StepCounterService.start(context)
                }

                Log.d(TAG, "setServerStepFloor — server=$serverSteps, native=$currentSteps, injected offset=$deficit")
                promise.resolve(true)
            } else {
                Log.d(TAG, "setServerStepFloor — server=$serverSteps <= native=$currentSteps, no action needed")
                promise.resolve(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "setServerStepFloor failed: ${e.message}", e)
            promise.resolve(false)
        }
    }
}
