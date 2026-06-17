package com.athlofit

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.RemoteViews
import java.text.SimpleDateFormat
import java.util.*

class StepsWidgetProvider : AppWidgetProvider() {

    companion object {
        const val TAG = "StepsWidgetProvider"
        const val PREFS_NAME = "StepsWidgetPrefs"
        private const val PREF_STEPS = "steps"
        private const val PREF_GOAL = "goal"
        private const val PREF_LAST_UPDATED = "lastUpdated"
        private const val PREF_LOGGED_OUT = "loggedOut"
        const val ACTION_REFRESH = "com.athlofit.athlofit.WIDGET_REFRESH"

        /**
         * Called from React Native (StepsWidgetModule) and from WidgetUpdateWorker.
         * Saves data to SharedPreferences then pushes a UI refresh broadcast.
         * Only updates lastUpdated timestamp when the step count actually changes
         * so the widget shows an accurate "Xm ago" time, not "just now" every run.
         */
        fun updateWidget(context: Context, steps: Int, goal: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val prevSteps = prefs.getInt(PREF_STEPS, -1)
            val stepsChanged = prevSteps != steps

            prefs.edit().apply {
                putInt(PREF_STEPS, steps)
                putInt(PREF_GOAL, goal)
                // Only stamp lastUpdated when the step count actually changed.
                // This prevents the widget from showing "Updated just now" on
                // every 15-min worker run even when the user hasn't moved.
                if (stepsChanged) {
                    putLong(PREF_LAST_UPDATED, System.currentTimeMillis())
                }
                apply()
            }

            // Trigger onUpdate for all active widget instances
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, StepsWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            if (appWidgetIds.isNotEmpty()) {
                val intent = Intent(context, StepsWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
                }
                context.sendBroadcast(intent)
                Log.d(TAG, "Widget broadcast sent: $steps steps / $goal goal")
            }
        }

        /**
         * Save login timestamp so the background worker can filter steps correctly.
         */
        fun saveLoginTimestamp(context: Context, timestamp: Long) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putLong("loginTimestamp", timestamp)
                .apply()
        }

        /**
         * Clear login timestamp on logout.
         */
        fun clearLoginTimestamp(context: Context) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .remove("loginTimestamp")
                .apply()
        }

        /**
         * Mark the widget as "logged out" — the next render will show a
         * "You are logged out" message instead of step data.
         */
        fun setLoggedOut(context: Context, loggedOut: Boolean) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean(PREF_LOGGED_OUT, loggedOut)
                .apply()

            // Immediately refresh all widget instances so the UI updates now
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, StepsWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            if (appWidgetIds.isNotEmpty()) {
                val intent = Intent(context, StepsWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
                }
                context.sendBroadcast(intent)
                Log.d(TAG, "Widget logged-out state broadcast sent: loggedOut=$loggedOut")
            }
        }

        /**
         * Mark the widget as "maintenance mode" — the next render will show
         * the maintenance message instead of step data.
         */
        fun setMaintenance(context: Context, enabled: Boolean, message: String?) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putBoolean("maintenance", enabled)
                .putString("maintenanceMessage", message ?: "Under maintenance. Back soon!")
                .apply()

            // Immediately refresh all widget instances
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, StepsWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)

            if (appWidgetIds.isNotEmpty()) {
                val intent = Intent(context, StepsWidgetProvider::class.java).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds)
                }
                context.sendBroadcast(intent)
                Log.d(TAG, "Widget maintenance state broadcast sent: enabled=$enabled")
            }
        }
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    /** Called when the FIRST widget instance is added to the home screen. */
    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        Log.d(TAG, "Widget enabled — starting background updates")
        WidgetScheduler.schedule(context)
        // Run one immediately so the widget isn't blank
        WidgetScheduler.runNow(context)
    }

    /** Called when the LAST widget instance is removed from the home screen. */
    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        Log.d(TAG, "Widget disabled — stopping background updates")
        WidgetScheduler.cancel(context)
    }

    /** Called by Android system periodically AND by our broadcast. */
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            renderWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        if (intent.action == ACTION_REFRESH) {
            Log.d(TAG, "Refresh tapped — running immediate update")
            WidgetScheduler.runNow(context)
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private fun renderWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isLoggedOut = prefs.getBoolean(PREF_LOGGED_OUT, false)
        val isMaintenance = prefs.getBoolean("maintenance", false)
        val views = RemoteViews(context.packageName, R.layout.widget_steps)

        if (isMaintenance) {
            // ── Maintenance state: show maintenance message ───────────────────
            val message = prefs.getString("maintenanceMessage", "Under maintenance. Back soon!") ?: "Under maintenance. Back soon!"
            views.setTextViewText(R.id.widget_steps, "🔧")
            views.setTextViewText(R.id.widget_goal_text, message)
            views.setProgressBar(R.id.widget_progress, 100, 0, false)
            views.setTextViewText(R.id.widget_percentage, "")
            views.setTextViewText(R.id.widget_last_updated, "We'll be back soon")

            // Tap widget → open app
            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                }

            if (launchIntent != null) {
                val openPi = PendingIntent.getActivity(
                    context,
                    1,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, openPi)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
            return
        }

        if (isLoggedOut) {
            // ── Logged-out state: show message, hide step data ─────────────────
            views.setTextViewText(R.id.widget_steps, "—")
            views.setTextViewText(R.id.widget_goal_text, "You are logged out")
            views.setProgressBar(R.id.widget_progress, 100, 0, false)
            views.setTextViewText(R.id.widget_percentage, "")
            views.setTextViewText(R.id.widget_last_updated, "Tap to sign in")

            // Tap widget → open app (to sign in)
            val launchIntent = context.packageManager
                .getLaunchIntentForPackage(context.packageName)
                ?.apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                }

            if (launchIntent != null) {
                val openPi = PendingIntent.getActivity(
                    context,
                    1,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, openPi)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
            return
        }

        // ── Normal state: show step data ──────────────────────────────────────
        val steps = prefs.getInt(PREF_STEPS, 0)
        val goal = prefs.getInt(PREF_GOAL, 10000)
        val lastUpdated = prefs.getLong(PREF_LAST_UPDATED, 0)

        // Steps count
        views.setTextViewText(R.id.widget_steps, formatNumber(steps))

        // Goal text
        views.setTextViewText(R.id.widget_goal_text, "of ${formatNumber(goal)} goal")

        // Progress bar (0–100)
        val progress = if (goal > 0) {
            ((steps.toFloat() / goal.toFloat()) * 100).toInt().coerceIn(0, 100)
        } else 0
        views.setProgressBar(R.id.widget_progress, 100, progress, false)

        // Percentage label
        views.setTextViewText(R.id.widget_percentage, "$progress%")

        // Last updated label
        val timeText = if (lastUpdated > 0) "Updated ${formatTime(lastUpdated)}" else "Tap to refresh"
        views.setTextViewText(R.id.widget_last_updated, timeText)

        // Refresh button → triggers immediate background update via AlarmManager
        val refreshIntent = Intent(context, StepsWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPi = PendingIntent.getBroadcast(
            context, 0, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPi)

        // Tap anywhere on the widget → open app.
        // Must use PendingIntent.getActivity(), NOT startActivity() from a BroadcastReceiver.
        // On Android 10+ background processes cannot start activities directly — it fails silently.
        val launchIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            }

        if (launchIntent != null) {
            val openPi = PendingIntent.getActivity(
                context,
                1,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            // Root layout — whole widget body is tappable
            views.setOnClickPendingIntent(R.id.widget_root, openPi)
        }

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun formatNumber(n: Int): String =
        if (n >= 1000) String.format(Locale.US, "%,d", n) else n.toString()

    private fun formatTime(ts: Long): String {
        val diff = System.currentTimeMillis() - ts
        return when {
            diff < 60_000L -> "just now"
            diff < 3_600_000L -> "${diff / 60_000}m ago"
            diff < 86_400_000L -> "${diff / 3_600_000}h ago"
            else -> SimpleDateFormat("MMM dd, HH:mm", Locale.US).format(Date(ts))
        }
    }
}
