package com.athlofit

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Manages the ACTIVITY_RECOGNITION runtime permission required for step sensor access
 * on Android 10+ (API 29+). Handles permission requests with retry logic (max 2 retries
 * per app session).
 */
object StepPermissionManager {

    private var retryCount: Int = 0
    private const val MAX_RETRIES = 2
    const val PERMISSION_REQUEST_CODE = 9001

    private var pendingCallback: ((Boolean) -> Unit)? = null

    /**
     * Returns true when the device requires ACTIVITY_RECOGNITION permission (Android 10+/API 29+).
     * On devices below API 29, step sensor access does not require this permission.
     */
    fun needsPermission(): Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q

    /**
     * Checks whether the ACTIVITY_RECOGNITION permission is currently granted.
     * On devices below API 29, always returns true since the permission is not required.
     */
    fun isGranted(context: Context): Boolean {
        if (!needsPermission()) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACTIVITY_RECOGNITION
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Returns the current permission status as a string:
     * - "granted" if the permission is granted (or not needed on API < 29)
     * - "denied" if the permission is denied on API 29+
     * - "not_required" if the device is below API 29
     */
    fun getStatus(context: Context): String {
        if (!needsPermission()) return "not_required"
        return if (isGranted(context)) "granted" else "denied"
    }

    /**
     * Requests the ACTIVITY_RECOGNITION permission with retry logic.
     * - If the permission is already granted, the callback is invoked immediately with true.
     * - If the device does not require the permission (API < 29), the callback is invoked with true.
     * - If retries are exhausted (max 2 per session), the callback is invoked with false.
     * - Otherwise, requests the permission from the user.
     *
     * @param activity The activity to use for the permission request.
     * @param callback Invoked with true if permission is granted, false otherwise.
     */
    fun requestPermission(activity: Activity, callback: (Boolean) -> Unit) {
        // No permission needed on API < 29
        if (!needsPermission()) {
            callback(true)
            return
        }

        // Already granted
        if (isGranted(activity)) {
            callback(true)
            return
        }

        // Retries exhausted
        if (retryCount >= MAX_RETRIES) {
            callback(false)
            return
        }

        // Store callback and request permission
        pendingCallback = callback
        retryCount++

        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.ACTIVITY_RECOGNITION),
            PERMISSION_REQUEST_CODE
        )
    }

    /**
     * Should be called from the Activity's onRequestPermissionsResult to handle the
     * permission response. Invokes the pending callback with the result.
     *
     * @param requestCode The request code from onRequestPermissionsResult.
     * @param grantResults The grant results array.
     */
    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != PERMISSION_REQUEST_CODE) return

        val granted = grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED

        pendingCallback?.invoke(granted)
        pendingCallback = null
    }

    /**
     * Returns the current retry count for this session.
     * Useful for determining whether to show rationale or direct user to Settings.
     */
    fun getRetryCount(): Int = retryCount

    /**
     * Returns whether retry attempts have been exhausted for this session.
     */
    fun isRetryExhausted(): Boolean = retryCount >= MAX_RETRIES

    /**
     * Checks if the user has permanently denied the permission (selected "Don't ask again").
     * This is determined by shouldShowRequestPermissionRationale returning false when
     * the permission is not granted.
     */
    fun isPermanentlyDenied(activity: Activity): Boolean {
        if (!needsPermission()) return false
        if (isGranted(activity)) return false
        return !ActivityCompat.shouldShowRequestPermissionRationale(
            activity,
            Manifest.permission.ACTIVITY_RECOGNITION
        )
    }

    /**
     * Resets the retry count. Called internally — the retry count resets naturally
     * on app restart since this is an object (singleton) with in-memory state.
     * Exposed for testing purposes.
     */
    fun resetRetryCount() {
        retryCount = 0
    }
}
