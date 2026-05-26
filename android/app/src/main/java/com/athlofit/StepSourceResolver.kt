package com.athlofit

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build

/**
 * Determines the step data source based on device capabilities.
 *
 * Resolution logic:
 * - API >= 34: Health Connect is a platform component, use it.
 * - API < 34 with TYPE_STEP_COUNTER sensor: use the native hardware sensor.
 * - Otherwise (no sensor or null SensorManager): step counting is unavailable.
 */
object StepSourceResolver {

    enum class Source {
        HEALTH_CONNECT,
        NATIVE_SENSOR,
        UNAVAILABLE
    }

    /**
     * Resolves the best available step data source for the current device.
     *
     * @param context Application or activity context used to access system services.
     * @return The resolved [Source] indicating which step counting path to use.
     */
    fun resolve(context: Context): Source {
        if (Build.VERSION.SDK_INT >= 34) return Source.HEALTH_CONNECT

        val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
            ?: return Source.UNAVAILABLE

        sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            ?: return Source.UNAVAILABLE

        return Source.NATIVE_SENSOR
    }
}
