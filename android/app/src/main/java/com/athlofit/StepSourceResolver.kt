package com.athlofit

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager

/**
 * Determines the step data source based on device capabilities.
 *
 * Resolution logic (tiered approach):
 * - The native hardware step sensor (TYPE_STEP_COUNTER) is always the primary
 *   source for real-time step counting on ALL API levels. This ensures the app
 *   works immediately without requiring Health Connect permissions.
 * - Health Connect remains available as an optional enhancement for users who
 *   want richer health data (heart rate, sleep, calories from wearables).
 * - If no step sensor is present: step counting is unavailable.
 */
object StepSourceResolver {

    enum class Source {
        HEALTH_CONNECT,
        NATIVE_SENSOR,
        UNAVAILABLE
    }

    /**
     * Resolves the best available step data source for the current device.
     * Always prefers the native hardware sensor for step counting reliability.
     *
     * @param context Application or activity context used to access system services.
     * @return The resolved [Source] indicating which step counting path to use.
     */
    fun resolve(context: Context): Source {
        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            ?: return Source.UNAVAILABLE

        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            ?: return Source.UNAVAILABLE

        return Source.NATIVE_SENSOR
    }
}
