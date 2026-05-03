package com.athlofit

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class StepsWidgetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "StepsWidget"

    /** Update widget UI immediately from JS (called when app is open). */
    @ReactMethod
    fun updateWidget(steps: Int, goal: Int, promise: Promise) {
        try {
            StepsWidgetProvider.updateWidget(reactApplicationContext, steps, goal)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("UPDATE_ERROR", e.message, e)
        }
    }

    /**
     * Start the background auto-update scheduler.
     * Call this on login so the widget keeps updating even when app is closed.
     */
    @ReactMethod
    fun startAutoUpdate(promise: Promise) {
        try {
            WidgetScheduler.schedule(reactApplicationContext)
            WidgetScheduler.runNow(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SCHEDULE_ERROR", e.message, e)
        }
    }

    /**
     * Stop the background auto-update scheduler.
     * Call this on logout.
     */
    @ReactMethod
    fun stopAutoUpdate(promise: Promise) {
        try {
            WidgetScheduler.cancel(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    /**
     * Save the login timestamp so the background worker filters steps correctly.
     * Call this right after login.
     */
    @ReactMethod
    fun setLoginTimestamp(timestamp: Double, promise: Promise) {
        try {
            StepsWidgetProvider.saveLoginTimestamp(
                reactApplicationContext,
                timestamp.toLong()
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TIMESTAMP_ERROR", e.message, e)
        }
    }

    /**
     * Clear login timestamp on logout.
     */
    @ReactMethod
    fun clearLoginTimestamp(promise: Promise) {
        try {
            StepsWidgetProvider.clearLoginTimestamp(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TIMESTAMP_ERROR", e.message, e)
        }
    }

    /** Check if widget data exists (i.e. widget has been added at least once). */
    @ReactMethod
    fun isWidgetAdded(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                "StepsWidgetPrefs", Context.MODE_PRIVATE
            )
            promise.resolve(prefs.contains("steps"))
        } catch (e: Exception) {
            promise.reject("CHECK_ERROR", e.message, e)
        }
    }
}
