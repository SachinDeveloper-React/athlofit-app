package com.athlofit

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * MidnightResetReceiver
 *
 * BroadcastReceiver triggered by AlarmManager at midnight (00:00:00) as a
 * fallback reset trigger for the step counter.
 *
 * Behavior:
 * - If StepCounterService is not running: starts it, which triggers handleDateChangeOnStart()
 *   to detect the date change and perform the midnight reset.
 * - If StepCounterService is already running: starts it with an EXTRA_MIDNIGHT_RESET intent
 *   extra, causing onStartCommand to call performMidnightReset directly.
 *
 * After firing, reschedules the next midnight alarm via MidnightAlarmScheduler
 * to ensure the alarm chain is never broken (even if the service fails to start).
 */
class MidnightResetReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "MidnightResetReceiver"
        const val EXTRA_MIDNIGHT_RESET = "com.athlofit.athlofit.EXTRA_MIDNIGHT_RESET"

        /**
         * Repaints the ongoing step notification to "0 steps today" right now,
         * without waiting for StepCounterService to start or reach its reset path.
         *
         * Only updates a notification that is already on screen. Posting blindly
         * would create an orphan ongoing notification (it is setOngoing(true), so
         * the user cannot dismiss it) on devices where the service is not running
         * and never comes back.
         *
         * @return true if the notification was repainted.
         */
        fun zeroNotificationNow(context: Context): Boolean {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return false
            return try {
                val isVisible = nm.activeNotifications.any { it.id == StepCounterService.NOTIF_ID }
                if (!isVisible) {
                    Log.d(TAG, "Step notification not on screen — nothing to repaint")
                    return false
                }
                StepCounterService.ensureNotificationChannel(context, nm)
                // buildNotification clamps at 0, so this renders "0 steps today"
                // regardless of what is currently persisted.
                nm.notify(StepCounterService.NOTIF_ID, StepCounterService.buildNotification(context, 0))
                Log.d(TAG, "Step notification repainted to 0 at midnight")
                StepCounterService.debugLog(context, "MIDNIGHT_NOTIF_ZEROED (receiver)")
                true
            } catch (e: Exception) {
                Log.w(TAG, "Could not repaint step notification: ${e.message}")
                false
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent?) {
        Log.d(TAG, "Midnight alarm received — starting StepCounterService with midnight reset extra")

        // ── Repaint the notification FIRST, synchronously ─────────────────────
        // This receiver runs at exactly 00:00:00, but until now it only zeroed the
        // WIDGET here and left the notification to be repainted by the service —
        // which only happens if startForegroundService() below succeeds AND reaches
        // performMidnightReset(). On OEM ROMs that refuse background FGS starts, or
        // whenever the service needs time to come up, the notification kept showing
        // yesterday's total for minutes while the widget already read 0.
        //
        // Posting to NOTIF_ID from here updates the service's foreground notification
        // in place when the service is alive, so there is no conflict — the same
        // technique pushStepUpdate() already uses from outside the service.
        zeroNotificationNow(context)

        // Immediately reset the widget to 0 steps. This ensures the widget shows
        // "0 steps" at midnight even if the service fails to start (OEM restriction).
        // The service will update it with the correct count once it starts.
        val widgetPrefs = context.getSharedPreferences("StepsWidgetPrefs", Context.MODE_PRIVATE)
        val goal = widgetPrefs.getInt("goal", StepsWidgetProvider.DEFAULT_DAILY_STEP_GOAL)
        StepsWidgetProvider.updateWidget(context, 0, goal)

        // Also reset the notification step count in SharedPreferences so the
        // notification shows 0 when the service restarts.
        val stepPrefs = context.getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE)
        val today = java.time.LocalDate.now().format(java.time.format.DateTimeFormatter.ISO_LOCAL_DATE)
        val storedDate = stepPrefs.getString("storedDate", "") ?: ""
        if (storedDate.isNotEmpty() && storedDate != today) {
            // Seed the new baseline from the last accepted sensor reading, but only if
            // the heartbeat shows the service was alive up to now. A reading taken
            // before the service was killed predates steps the hardware counted
            // unobserved, and using it as the boundary carries them into the new day.
            // 0 means "re-seed from the next sensor event" — StepCounterService treats
            // baseline == 0 as uninitialised. See resolveMidnightBaseline.
            //
            // This also no longer falls back to the OLD baseline, which was strictly
            // worse than re-seeding: it left the whole of yesterday's count in place.
            val lastCumulative = stepPrefs.getLong("lastCumulative", 0L)
            val heartbeatAt = stepPrefs.getLong(StepCounterService.HEARTBEAT_KEY, 0L)
            val newBaseline = resolveMidnightBaseline(
                lastCumulative = lastCumulative,
                heartbeatAtMs = heartbeatAt,
                nowMs = System.currentTimeMillis(),
                heartbeatStaleMs = StepCounterService.HEARTBEAT_STALE_MS,
            )

            // Record the closing day's total BEFORE zeroing it.
            //
            // The two in-service reset paths (onSensorChanged and handleMultiDayGap)
            // both persist history first; this one did not, so whenever the receiver
            // won the race — i.e. exactly when the service was dead and could not do
            // it — the day's local total was overwritten with 0 and lost. History
            // merges by max, so writing it here is safe even if the service later
            // runs its own reset for the same date.
            val closingSteps = stepPrefs.getInt("dailySteps", 0)
            if (closingSteps > 0) {
                StepCounterService.persistStepHistory(context, storedDate, closingSteps)
            }

            stepPrefs.edit()
                .putInt("dailySteps", 0)
                .putInt("rebootOffset", 0)
                .putLong("baseline", newBaseline)
                .putString("storedDate", today)
                .apply()
            Log.d(TAG, "Reset StepCounterPrefs for new day: $storedDate → $today, baseline=$newBaseline, lastCum=$lastCumulative, archived=$closingSteps")
        }

        val serviceIntent = Intent(context, StepCounterService::class.java).apply {
            putExtra(EXTRA_MIDNIGHT_RESET, true)
        }

        try {
            context.startForegroundService(serviceIntent)
        } catch (e: Exception) {
            // On some OEMs (Xiaomi MIUI, Huawei EMUI), starting a foreground service
            // from a BroadcastReceiver can throw if the app is in a restricted state.
            // The widget is already reset above. The service will detect the day
            // change on the next sensor event or when the user opens the app.
            Log.e(TAG, "Failed to start StepCounterService from midnight alarm: ${e.message}", e)
        }

        // Always reschedule the next midnight alarm as a safety net.
        // Normally the service also reschedules in performMidnightReset(), but if the
        // service failed to start above, this ensures the alarm chain isn't broken.
        MidnightAlarmScheduler.schedule(context)
    }
}
