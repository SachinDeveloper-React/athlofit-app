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
import java.time.LocalDate
import java.time.format.DateTimeFormatter
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
         * Calendar day (YYYY-MM-DD) the persisted [PREF_STEPS] value belongs to.
         *
         * The notification has always had a stale-date guard (see
         * StepCounterService.buildNotification) but the widget had none: it rendered
         * whatever number was in SharedPreferences, forever. If every midnight reset
         * path was missed — service dead, alarm dropped, worker not yet run — the
         * widget kept showing yesterday's total while the notification correctly read
         * 0, and formatTime()'s "MMM dd, HH:mm" branch would happily label it as
         * days old.
         *
         * lastUpdated is not usable for this: updateWidget only stamps it when the
         * count CHANGES, so an unchanged count carries a timestamp from whenever it
         * last moved. This key is written by every writer on every write, so it says
         * exactly which day the number describes.
         *
         * Public because StepCounterService writes widget prefs directly (from
         * updateWidget() and pushStepUpdate()) rather than through this class.
         */
        const val PREF_STEPS_DATE = "stepsDate"

        /** Today as YYYY-MM-DD, the format stored in [PREF_STEPS_DATE]. */
        fun todayStamp(): String =
            LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        /**
         * Step goal assumed when [PREF_GOAL] has not been written yet — a fresh
         * install before the app's first widget sync, or a widget added before login.
         *
         * Matches `User.dailyStepGoal`'s schema default on the backend, which is the
         * number that actually decides things: the server awards the daily step-goal
         * coins and persists `goalMet` against it. Anything else here means the
         * widget and notification draw a progress ring against one goal while coins
         * are paid against another.
         *
         * It was written as a bare `10000` literal at seven separate call sites
         * across five files, which is how the app's own fallback drifted to 8,000
         * without the native side following. One constant, one place to change it.
         */
        const val DEFAULT_DAILY_STEP_GOAL = 10_000

        const val PREF_APP_INITIALISING = "appInitialising"
        const val PREF_APP_INITIALISING_AT = "appInitialisingAt"

        /**
         * How long the "app is initialising" flag is honoured before it is treated
         * as abandoned. Its callers wrap a Health Connect init with a 10-second
         * timeout, so anything past a couple of minutes is not an init in progress.
         */
        private const val APP_INITIALISING_MAX_AGE_MS = 2 * 60 * 1000L

        /**
         * True while the JS layer is initialising Health Connect, so background
         * workers must not touch HealthConnectClient concurrently.
         *
         * Expires. The flag is set before init and cleared in a `finally`, but a
         * `finally` does not run when the process is killed — and nothing reset it
         * on process death or boot. A single kill mid-initialisation therefore left
         * it stuck true, and both WidgetUpdateWorker and EodSyncWorker no-oped
         * forever: the widget froze and the end-of-day sync silently stopped, with
         * the manual refresh tap doing nothing either.
         */
        fun isAppInitialising(context: Context): Boolean {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            if (!prefs.getBoolean(PREF_APP_INITIALISING, false)) return false

            val setAt = prefs.getLong(PREF_APP_INITIALISING_AT, 0L)
            val age = System.currentTimeMillis() - setAt
            if (setAt <= 0L || age > APP_INITIALISING_MAX_AGE_MS) {
                Log.w(TAG, "appInitialising flag is stale (age=${if (setAt > 0) age / 1000 else -1}s) — clearing")
                prefs.edit()
                    .putBoolean(PREF_APP_INITIALISING, false)
                    .remove(PREF_APP_INITIALISING_AT)
                    .apply()
                return false
            }
            return true
        }

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
                // Which day this count describes. Written unconditionally so the
                // render path can tell a fresh 0 from yesterday's leftover total.
                putString(PREF_STEPS_DATE, todayStamp())
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
        val rawSteps = prefs.getInt(PREF_STEPS, 0)
        val goal = prefs.getInt(PREF_GOAL, DEFAULT_DAILY_STEP_GOAL)
        val lastUpdated = prefs.getLong(PREF_LAST_UPDATED, 0)

        // ── Stale-date guard (mirrors StepCounterService.buildNotification) ────
        // Render 0 rather than a count that belongs to a previous day. Two
        // independent signals, because either one can be the only one available:
        //
        //  - stepsDate: written by every widget-prefs writer. Authoritative, but
        //    absent until the first write after this build ships.
        //  - StepCounterPrefs.storedDate: the tracking day the step service is on.
        //    This is the same signal the notification guards against, so using it
        //    here is what stops the two surfaces from disagreeing.
        //
        // Without this the widget was the one surface with no day awareness at all:
        // it rendered SharedPreferences verbatim and kept yesterday's total on
        // screen indefinitely whenever every midnight reset path was missed.
        val today = todayStamp()
        val stepsDate = prefs.getString(PREF_STEPS_DATE, "") ?: ""
        val trackingDate = context
            .getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE)
            .getString("storedDate", "") ?: ""
        val isStale = (stepsDate.isNotEmpty() && stepsDate != today) ||
            (trackingDate.isNotEmpty() && trackingDate != today)
        val steps = if (isStale) {
            Log.d(TAG, "Stale step data (stepsDate=$stepsDate, trackingDate=$trackingDate, today=$today) — rendering 0")
            0
        } else {
            maxOf(0, rawSteps)
        }

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

        // Last updated label. When the data is stale the timestamp describes a
        // previous day, so showing "Updated 9h ago" next to a zeroed count would
        // just be misleading — prompt a refresh instead.
        val timeText = when {
            isStale -> "Tap to refresh"
            lastUpdated > 0 -> "Updated ${formatTime(lastUpdated)}"
            else -> "Tap to refresh"
        }
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
