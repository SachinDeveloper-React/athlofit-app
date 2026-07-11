package com.athlofit

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * FIX #10: Secure storage for the access token.
 *
 * Uses EncryptedSharedPreferences (AES-256 GCM) so the Bearer token is not
 * readable in plaintext on rooted devices. Non-sensitive data (steps, goal,
 * weightKg) stays in the regular StepsWidgetPrefs for performance — only the
 * token is encrypted.
 *
 * Falls back to regular SharedPreferences if encryption fails (e.g., KeyStore
 * corruption after OS update). This ensures the sync/widget don't break — the
 * worst case is cleartext storage, same as before.
 */
object SecureTokenStore {
    private const val TAG = "SecureTokenStore"
    private const val ENCRYPTED_PREFS_NAME = "AthloFitSecurePrefs"
    private const val KEY_ACCESS_TOKEN = "accessToken"
    private const val KEY_BASE_URL = "baseUrl"

    // Legacy prefs name (for migration)
    private const val LEGACY_PREFS_NAME = "StepsWidgetPrefs"

    private var _encryptedPrefs: SharedPreferences? = null

    /**
     * Returns the EncryptedSharedPreferences instance, creating it if needed.
     * Returns null if encryption is not available (falls back to cleartext).
     */
    private fun getEncryptedPrefs(context: Context): SharedPreferences? {
        _encryptedPrefs?.let { return it }

        return try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            val prefs = EncryptedSharedPreferences.create(
                context,
                ENCRYPTED_PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
            _encryptedPrefs = prefs
            prefs
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create EncryptedSharedPreferences: ${e.message}", e)
            null
        }
    }

    /**
     * Save the access token securely.
     * Also migrates any legacy cleartext token from StepsWidgetPrefs.
     */
    fun saveToken(context: Context, token: String) {
        val prefs = getEncryptedPrefs(context)
        if (prefs != null) {
            prefs.edit().putString(KEY_ACCESS_TOKEN, token).apply()
            // Remove cleartext token from legacy prefs (migration)
            context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove("accessToken")
                .apply()
        } else {
            // Fallback: store in regular prefs (same as before, non-fatal)
            context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("accessToken", token)
                .apply()
        }
    }

    /**
     * Read the access token. Checks encrypted store first, then legacy fallback.
     */
    fun getToken(context: Context): String {
        // Try encrypted store first
        val prefs = getEncryptedPrefs(context)
        val encrypted = prefs?.getString(KEY_ACCESS_TOKEN, "") ?: ""
        if (encrypted.isNotEmpty()) return encrypted

        // Fallback: check legacy cleartext prefs (pre-migration)
        val legacy = context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
            .getString("accessToken", "") ?: ""

        // If found in legacy, migrate it to encrypted store
        if (legacy.isNotEmpty() && prefs != null) {
            prefs.edit().putString(KEY_ACCESS_TOKEN, legacy).apply()
            context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove("accessToken")
                .apply()
            Log.d(TAG, "Migrated token from cleartext to encrypted store")
        }

        return legacy
    }

    /**
     * Clear the stored token (on logout).
     */
    fun clearToken(context: Context) {
        getEncryptedPrefs(context)?.edit()?.remove(KEY_ACCESS_TOKEN)?.apply()
        // Also clear from legacy just in case
        context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .remove("accessToken")
            .apply()
    }

    /**
     * Save the base URL securely (also sensitive since it identifies the API).
     */
    fun saveBaseUrl(context: Context, url: String) {
        val prefs = getEncryptedPrefs(context)
        if (prefs != null) {
            prefs.edit().putString(KEY_BASE_URL, url).apply()
        } else {
            context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString("baseUrl", url)
                .apply()
        }
    }

    /**
     * Read the base URL.
     */
    fun getBaseUrl(context: Context): String {
        val prefs = getEncryptedPrefs(context)
        val encrypted = prefs?.getString(KEY_BASE_URL, "") ?: ""
        if (encrypted.isNotEmpty()) return encrypted

        return context.getSharedPreferences(LEGACY_PREFS_NAME, Context.MODE_PRIVATE)
            .getString("baseUrl", "https://api.athlofit.com") ?: "https://api.athlofit.com"
    }
}
