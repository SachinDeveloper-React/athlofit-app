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
        const val ACTION_REFRESH = "com.athlofit.WIDGET_REFRESH"
        private const val ACTION_OPEN_APP = "com.athlofit.WIDGET_OPEN_APP"

        /**
         * Called from React Native (StepsWidgetModule) and from WidgetUpdateWorker.
         * Saves data to SharedPreferences then pushes a UI refresh broadcast.
         */
        fun updateWidget(context: Context, steps: Int, goal: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putInt(PREF_STEPS, steps)
                putInt(PREF_GOAL, goal)
                putLong(PREF_LAST_UPDATED, System.currentTimeMillis())
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

        when (intent.action) {
            ACTION_REFRESH -> {
                Log.d(TAG, "Refresh tapped — running immediate update")
                // Run a background job immediately to fetch fresh Health Connect data
                WidgetScheduler.runNow(context)
            }
            ACTION_OPEN_APP -> {
                val launchIntent = context.packageManager
                    .getLaunchIntentForPackage(context.packageName)
                launchIntent?.let {
                    it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    context.startActivity(it)
                }
            }
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private fun renderWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val steps = prefs.getInt(PREF_STEPS, 0)
        val goal = prefs.getInt(PREF_GOAL, 10000)
        val lastUpdated = prefs.getLong(PREF_LAST_UPDATED, 0)

        val views = RemoteViews(context.packageName, R.layout.widget_steps)

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

        // Refresh button → triggers WidgetUpdateWorker immediately
        val refreshIntent = Intent(context, StepsWidgetProvider::class.java).apply {
            action = ACTION_REFRESH
        }
        val refreshPi = PendingIntent.getBroadcast(
            context, 0, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_refresh, refreshPi)

        // Tap on steps → open app
        val openIntent = Intent(context, StepsWidgetProvider::class.java).apply {
            action = ACTION_OPEN_APP
        }
        val openPi = PendingIntent.getBroadcast(
            context, 1, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_steps, openPi)

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
