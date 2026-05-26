package com.athlofit

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
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
 * On API >= 34, the module skips sensor checks and does not start the service,
 * relying on the existing Health Connect integration.
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
         */
        fun emitStepUpdate(steps: Int) {
            val now = System.currentTimeMillis()
            if (now - lastEmitTime < EVENT_THROTTLE_MS) return
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
     * - On API >= 34: rejects (Health Connect is the source, not native sensor)
     * - Checks StepSourceResolver — if not NATIVE_SENSOR, rejects with error
     * - Checks StepPermissionManager — if permission needed and not granted, rejects
     * - Starts StepCounterService and resolves with true
     */
    @ReactMethod
    fun start(promise: Promise) {
        try {
            val context = reactApplicationContext

            // On API >= 34, skip — rely on Health Connect
            if (Build.VERSION.SDK_INT >= 34) {
                promise.reject(
                    "SOURCE_NOT_NATIVE",
                    "Device uses Health Connect (API >= 34). Native step service not applicable."
                )
                return
            }

            // Check source resolution
            val source = StepSourceResolver.resolve(context)
            if (source != StepSourceResolver.Source.NATIVE_SENSOR) {
                promise.reject(
                    "SOURCE_NOT_NATIVE",
                    "Step source is not native sensor. Resolved: ${source.name}"
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
     * Returns the current daily step count from StepDataStore (SharedPreferences).
     * Returns 0 if no data has been recorded for the current day.
     */
    @ReactMethod
    fun getCurrentSteps(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE
            )
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
}
