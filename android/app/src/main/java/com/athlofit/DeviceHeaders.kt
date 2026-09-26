package com.athlofit

import android.annotation.SuppressLint
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
     * The one ANDROID_ID an old Android release handed to every device alike.
     * Useless as an identifier, so it is treated as absent.
     */
    private const val SHARED_LEGACY_ANDROID_ID = "9774d56d682e549c"

    /**
     * The install's identifier — the SAME value the JS layer sends.
     *
     * The JS side (utils/deviceInfo.ts) sends react-native-device-info's
     * getUniqueIdSync(), which on Android is Settings.Secure.ANDROID_ID. This
     * used to send a random UUID of its own instead, so one phone reported two
     * install ids, alternating with every sync between the foreground service
     * and the app. The server appends to the user's device history whenever the
     * id changes, so every service sync pushed an entry and the 20-entry cap
     * evicted the real update trail within hours — one account's history was
     * nothing but the two ids taking turns.
     *
     * ANDROID_ID adds nothing the JS layer does not already send on every
     * request. Since Android 8 it is scoped to the app's signing key and to the
     * Android user, so it is not a hardware id — and a second copy of the app
     * under another user profile ("Dual apps") gets its own, which is exactly
     * the distinction the server needs to see.
     *
     * The old UUID is kept only as a fallback for a device that has no usable
     * ANDROID_ID.
     */
    @SuppressLint("HardwareIds")
    private fun installId(context: Context): String {
        try {
            val androidId = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID,
            )
            if (!androidId.isNullOrEmpty() && androidId != SHARED_LEGACY_ANDROID_ID) {
                return androidId
            }
        } catch (e: Exception) {
            // Fall through to the stored id.
        }

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
