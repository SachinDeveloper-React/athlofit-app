package com.athlofit

import android.content.Context
import android.os.Build
import android.provider.Settings
import java.net.HttpURLConnection
import java.util.UUID

/**
 * The X-App-* identity headers that every backend call must carry.
 *
 * The JS layer sends these from utils/deviceInfo.ts, but three Android callers
 * never go through JS at all — StepCounterService (foreground service),
 * WidgetUpdateWorker and EodSyncWorker (WorkManager). Those keep POSTing steps
 * while the app is closed or killed, so without headers here the syncs that are
 * hardest to explain after the fact would be exactly the anonymous ones.
 *
 * `X-Client-Source` distinguishes them, so a bad step submission can be traced
 * to the specific code path that produced it rather than just "the app".
 */
object DeviceHeaders {

    private const val PREFS_NAME = "StepsWidgetPrefs"
    private const val KEY_INSTALL_ID = "installId"

    /**
     * Stable per-install identifier — the SAME value the JS layer sends.
     *
     * utils/deviceInfo.ts sends react-native-device-info's getUniqueId(), which
     * on Android is ANDROID_ID. This used to be a random UUID instead, so one
     * install reported two installIds: the UUID from the foreground service and
     * native worker, ANDROID_ID from the app and the JS background sync. The
     * backend records every installId change as a new device, so a single phone
     * filled its 20-entry deviceHistory with the two alternating every few
     * minutes — losing the real version history, and looking exactly like the
     * two-installs-on-one-phone pattern used to spot Dual-apps clones.
     *
     * ANDROID_ID is per app-signing key and per Android user, so a cloned copy
     * of the app still reports its own. The UUID is kept only as a fallback for
     * a device that returns no ANDROID_ID at all.
     */
    private fun installId(context: Context): String {
        val androidId = try {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
        } catch (e: Exception) {
            null
        }
        if (!androidId.isNullOrEmpty()) return androidId

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(KEY_INSTALL_ID, null)
        if (!existing.isNullOrEmpty()) return existing
        val fresh = UUID.randomUUID().toString()
        prefs.edit().putString(KEY_INSTALL_ID, fresh).apply()
        return fresh
    }

    /**
     * Apply the headers to an open connection.
     *
     * @param source "native_service" for the foreground step service,
     *               "worker" for WorkManager-driven syncs.
     */
    fun apply(conn: HttpURLConnection, context: Context, source: String) {
        try {
            conn.setRequestProperty("X-App-Version", BuildConfig.VERSION_NAME)
            conn.setRequestProperty("X-App-Build", BuildConfig.VERSION_CODE.toString())
            conn.setRequestProperty("X-Platform", "android")
            conn.setRequestProperty("X-OS-Version", Build.VERSION.RELEASE ?: "")
            conn.setRequestProperty("X-Device-Model", Build.MODEL ?: "")
            conn.setRequestProperty("X-Device-Brand", Build.MANUFACTURER ?: "")
            conn.setRequestProperty("X-Install-Id", installId(context))
            conn.setRequestProperty("X-Client-Source", source)
        } catch (e: Exception) {
            // Telemetry headers must never be able to break the request they
            // ride on — a sync without them is degraded, a crash here is not.
        }
    }
}
