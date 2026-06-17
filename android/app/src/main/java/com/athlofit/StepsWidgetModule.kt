package com.athlofit

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class StepsWidgetModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "StepsWidget"

    // ─── Widget UI ────────────────────────────────────────────────────────────

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

    // ─── Background scheduler ─────────────────────────────────────────────────

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

    @ReactMethod
    fun stopAutoUpdate(promise: Promise) {
        try {
            WidgetScheduler.cancel(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message, e)
        }
    }

    // ─── Login timestamp ──────────────────────────────────────────────────────

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

    @ReactMethod
    fun clearLoginTimestamp(promise: Promise) {
        try {
            StepsWidgetProvider.clearLoginTimestamp(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TIMESTAMP_ERROR", e.message, e)
        }
    }

    // ─── Logged-out widget state ──────────────────────────────────────────────

    /**
     * Mark the widget as "logged out" — displays a "You are logged out" message.
     * Call this on logout.
     */
    @ReactMethod
    fun setLoggedOut(loggedOut: Boolean, promise: Promise) {
        try {
            StepsWidgetProvider.setLoggedOut(reactApplicationContext, loggedOut)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LOGGED_OUT_ERROR", e.message, e)
        }
    }

    // ─── Maintenance widget state ─────────────────────────────────────────────

    /**
     * Mark the widget as "maintenance mode" — displays the maintenance message.
     * Call this when the app config indicates maintenance is enabled.
     */
    @ReactMethod
    fun setMaintenance(enabled: Boolean, message: String, promise: Promise) {
        try {
            StepsWidgetProvider.setMaintenance(reactApplicationContext, enabled, message)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("MAINTENANCE_ERROR", e.message, e)
        }
    }

    // ─── Access token (for EodSyncWorker) ─────────────────────────────────────

    /**
     * Save the current access token so EodSyncWorker can use it.
     * Call this on login AND every time the token is refreshed.
     */
    @ReactMethod
    fun saveAccessToken(token: String, promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
                .edit()
                .putString("accessToken", token)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TOKEN_SAVE_ERROR", e.message, e)
        }
    }

    /**
     * Clear the stored access token on logout.
     */
    @ReactMethod
    fun clearAccessToken(promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
                .edit()
                .remove("accessToken")
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("TOKEN_CLEAR_ERROR", e.message, e)
        }
    }

    // ─── User body metrics (for accurate calorie/distance derivation) ─────────
    //
    // The user's weight (kg) is stored in StepsWidgetPrefs so native background
    // workers (WidgetUpdateWorker, EodSyncWorker) can derive calories and
    // distance accurately instead of using the 70 kg default.

    /**
     * Save the user's weight in kg.
     * Call this on login and whenever the user updates their profile weight.
     */
    @ReactMethod
    fun saveUserWeight(weightKg: Double, promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
                .edit()
                .putFloat("weightKg", weightKg.toFloat())
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WEIGHT_SAVE_ERROR", e.message, e)
        }
    }

    /**
     * Clear the stored weight on logout.
     */
    @ReactMethod
    fun clearUserWeight(promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
                .edit()
                .remove("weightKg")
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WEIGHT_CLEAR_ERROR", e.message, e)
        }
    }

    // ─── App initialising flag ────────────────────────────────────────────────

    @ReactMethod
    fun setAppInitialising(initialising: Boolean, promise: Promise) {
        try {
            reactApplicationContext
                .getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
                .edit()
                .putBoolean("appInitialising", initialising)
                .apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INIT_FLAG_ERROR", e.message, e)
        }
    }

    // ─── Step counter notification (foreground service) ───────────────────────

    /**
     * Start the persistent step-count foreground notification.
     * Call this on login (after notification permission is granted).
     */
    @ReactMethod
    fun startStepNotification(promise: Promise) {
        try {
            StepNotificationService.start(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STEP_NOTIF_START_ERROR", e.message, e)
        }
    }

    /**
     * Stop the persistent step-count foreground notification.
     * Call this on logout.
     */
    @ReactMethod
    fun stopStepNotification(promise: Promise) {
        try {
            StepNotificationService.stop(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("STEP_NOTIF_STOP_ERROR", e.message, e)
        }
    }

    // ─── EOD sync alarm ───────────────────────────────────────────────────────

    @ReactMethod
    fun scheduleEodSync(promise: Promise) {
        try {
            EodSyncScheduler.schedule(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EOD_SCHEDULE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun cancelEodSync(promise: Promise) {
        try {
            EodSyncScheduler.cancel(reactApplicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("EOD_CANCEL_ERROR", e.message, e)
        }
    }

    // ─── Misc ─────────────────────────────────────────────────────────────────

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
