package com.athlofit

import android.content.Context
import android.util.Log

/**
 * Native-side enforcement of the per-user step-tracking kill switch.
 *
 * Turning the switch off in the JS store is not sufficient on Android. Step
 * counting lives in a foreground service plus two WorkManager jobs, all of
 * which the OS restarts on their own — on boot, after a task-kill, on the
 * keep-alive schedule — with no React context in sight. Anything that only
 * checks a JS flag would be silently overridden minutes later.
 *
 * So the flag is mirrored into SharedPreferences, every native sync path reads
 * it before posting, and a 403 from the server writes it even if the app is
 * not running. The state lives here so those three callers cannot drift apart.
 */
object StepTrackingGate {

    private const val TAG = "StepTrackingGate"
    private const val PREFS_NAME = "StepsWidgetPrefs"
    private const val KEY_DISABLED = "stepsTrackingDisabled"
    private const val KEY_REASON = "stepsTrackingReason"
    private const val KEY_BLOCKED_VERSION = "stepsBlockedVersion"
    private const val KEY_BLOCKED_VERSION_REASON = "stepsBlockedVersionReason"

    /** Error code the backend returns when this ACCOUNT is paused. */
    const val DISABLED_CODE = "STEPS_TRACKING_DISABLED"

    /** Error code the backend returns when this BUILD is barred. */
    const val VERSION_BLOCKED_CODE = "STEPS_VERSION_BLOCKED"

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Whether this device may count and sync steps.
     *
     * Defaults to true: an install that has never heard from the server, or one
     * whose prefs were cleared, must track normally. Only an explicit disable
     * turns it off.
     */
    fun isEnabled(context: Context): Boolean =
        !prefs(context).getBoolean(KEY_DISABLED, false) && !isVersionBlocked(context)

    fun reason(context: Context): String {
        if (isVersionBlocked(context)) {
            return prefs(context).getString(KEY_BLOCKED_VERSION_REASON, "") ?: ""
        }
        return prefs(context).getString(KEY_REASON, "") ?: ""
    }

    /**
     * Whether the server has barred the build currently installed.
     *
     * Stored as the version STRING, compared against BuildConfig, so installing
     * an update clears the block by itself — no server round-trip, which
     * matters because updating is the only remedy and the device may be offline
     * immediately afterwards. A stale entry from a previous build is cleaned up
     * on read so the comparison stays cheap.
     */
    fun isVersionBlocked(context: Context): Boolean {
        val blocked = prefs(context).getString(KEY_BLOCKED_VERSION, "") ?: ""
        if (blocked.isEmpty()) return false
        if (blocked != BuildConfig.VERSION_NAME) {
            prefs(context).edit()
                .remove(KEY_BLOCKED_VERSION)
                .remove(KEY_BLOCKED_VERSION_REASON)
                .apply()
            Log.d(TAG, "Cleared stale build block for $blocked (now on ${BuildConfig.VERSION_NAME})")
            return false
        }
        return true
    }

    /** Record that the running build may not submit steps, and shut it all down. */
    fun setVersionBlocked(context: Context, reason: String?) {
        prefs(context).edit()
            .putString(KEY_BLOCKED_VERSION, BuildConfig.VERSION_NAME)
            .putString(KEY_BLOCKED_VERSION_REASON, reason ?: "")
            .apply()
        Log.w(TAG, "Build ${BuildConfig.VERSION_NAME} barred from step sync — stopping native tracking")
        stopEverything(context)
    }

    /**
     * Set the flag and bring the native machinery in line.
     *
     * Disabling stops the foreground service and cancels the scheduled work, so
     * nothing is left running that could resume posting. Enabling only clears
     * the flag — restarting the service is left to the JS layer, which owns the
     * ACTIVITY_RECOGNITION permission flow and must not have a permission
     * dialog triggered from a background thread.
     */
    fun setEnabled(context: Context, enabled: Boolean, reason: String?) {
        val wasEnabled = isEnabled(context)
        prefs(context).edit()
            .putBoolean(KEY_DISABLED, !enabled)
            .putString(KEY_REASON, if (enabled) "" else (reason ?: ""))
            .apply()

        if (!enabled) {
            stopEverything(context)
        } else if (isVersionBlocked(context)) {
            // Account re-enabled, but the installed build is still barred.
            // Leave everything stopped — the JS layer mirrors the ACCOUNT state
            // here and knows nothing about the build gate.
            stopEverything(context)
        }

        if (wasEnabled != enabled) {
            Log.d(TAG, "Step tracking ${if (enabled) "ENABLED" else "DISABLED"}${if (reason.isNullOrEmpty()) "" else " — $reason"}")
        }
    }

    /**
     * Stop every native step producer.
     *
     * Called on every disable, not only on the transition, because the OS can
     * restart the service or re-enqueue work behind our back — a repeat disable
     * is a chance to shut down something that came back on its own.
     */
    fun stopEverything(context: Context) {
        try {
            StepCounterService.stop(context)
        } catch (e: Exception) {
            Log.w(TAG, "stop StepCounterService failed: ${e.message}")
        }
        try {
            WidgetScheduler.cancel(context)
        } catch (e: Exception) {
            Log.w(TAG, "cancel WidgetScheduler failed: ${e.message}")
        }
        try {
            EodSyncScheduler.cancel(context)
        } catch (e: Exception) {
            Log.w(TAG, "cancel EodSyncScheduler failed: ${e.message}")
        }
        try {
            StepServiceScheduler.cancel(context)
        } catch (e: Exception) {
            Log.w(TAG, "cancel StepServiceScheduler failed: ${e.message}")
        }
    }

    /**
     * Inspect a /health/sync response and act on a kill-switch rejection.
     *
     * Matches on the response BODY's `code`, not on the 403 status alone: a
     * suspended account also returns 403, and conflating the two would leave a
     * banned user's device permanently marked as step-disabled even after the
     * ban was lifted.
     *
     * @return true when the response was a step-tracking rejection
     */
    fun handleSyncResponse(context: Context, responseCode: Int, errorBody: String?): Boolean {
        if (responseCode != 403) return false
        if (errorBody == null) return false

        val isAccountBlock = errorBody.contains(DISABLED_CODE)
        val isVersionBlock = errorBody.contains(VERSION_BLOCKED_CODE)
        if (!isAccountBlock && !isVersionBlock) return false

        val message = try {
            org.json.JSONObject(errorBody).optString("message", "")
        } catch (e: Exception) {
            ""
        }

        // The two blocks are stored separately because they lift differently:
        // an account block is cleared by an admin and reported back through the
        // profile fetch, a build block is cleared only by installing an update.
        // Collapsing them would let a profile fetch un-block a bad build.
        if (isVersionBlock) {
            setVersionBlocked(context, message)
        } else {
            Log.w(TAG, "Server disabled step tracking for this account — stopping native tracking")
            setEnabled(context, false, message)
        }
        return true
    }

    /** Read an HttpURLConnection's error stream without throwing. */
    fun readErrorBody(conn: java.net.HttpURLConnection): String? = try {
        conn.errorStream?.bufferedReader()?.use { it.readText() }
    } catch (e: Exception) {
        null
    }
}
