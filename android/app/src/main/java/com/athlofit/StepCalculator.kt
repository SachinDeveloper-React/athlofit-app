package com.athlofit

/**
 * Hard ceiling for a single day's step count (defensive clamp).
 *
 * Deliberately the same 100,000 the backend enforces in stepValidation.js and the
 * app enforces in stepEngine.ts. It was previously 200,000, which meant the native
 * service would happily persist and display a value that the app and the server
 * both rejected — the layers disagreed about what was possible, so an impossible
 * number could survive in one of them and keep re-entering the pipeline.
 *
 * For scale: a marathon is roughly 50,000 steps.
 */
const val MAX_SANE_DAILY_STEPS = 100_000

/**
 * Pure data class representing the current step counter state.
 *
 * @property baseline Sensor value at start of day or after last counter reset
 * @property dailySteps Calculated as (cumulative - baseline) + rebootOffset
 * @property rebootOffset Accumulated steps from before the last counter reset
 */
data class StepState(
    val baseline: Long,
    val dailySteps: Int,
    val rebootOffset: Int
)

/**
 * Pure data class representing the result of a step calculation.
 *
 * @property baseline Updated baseline (changes only on a confirmed counter reset)
 * @property dailySteps Updated daily step count
 * @property rebootOffset Updated reboot offset (increases only on a counter reset)
 */
data class StepResult(
    val baseline: Long,
    val dailySteps: Int,
    val rebootOffset: Int
)

/**
 * Pure function that calculates the daily step count from sensor state.
 *
 * dailySteps = (cumulative - baseline) + rebootOffset
 *
 * ## Why `counterReset` is a parameter instead of being inferred here
 *
 * This function used to decide on its own that a reboot had happened whenever
 * `cumulative < baseline`. That is not a safe inference. Several sensor-hub HALs
 * (common on MediaTek/Unisoc devices) emit one or two events with a zero or very
 * low cumulative value after the hub restarts, without the device rebooting.
 * Every such glitch permanently folded the current day's count into
 * `rebootOffset` and moved the baseline down, so the total inflated a little more
 * each time — the step-inflation bug the app has been patching for months.
 *
 * The caller now confirms a genuine reset using SystemClock.elapsedRealtime()
 * (which restarts at 0 on boot and is monotonic within a boot) plus a
 * consecutive-drop counter for the rare case where the sensor really does reset
 * mid-boot. See StepCounterService.onSensorChanged.
 *
 * @param state The current step counter state
 * @param cumulative The cumulative step count from the TYPE_STEP_COUNTER sensor
 * @param counterReset True when the caller has confirmed the hardware counter
 *   restarted from zero (device reboot or a verified sensor reset).
 * @return The updated step calculation result
 */
fun calculateSteps(
    state: StepState,
    cumulative: Long,
    counterReset: Boolean
): StepResult {
    var newBaseline = state.baseline
    var newRebootOffset = state.rebootOffset

    if (counterReset) {
        // Carry the steps already counted today over into the offset, then
        // re-baseline onto the restarted hardware counter.
        newRebootOffset += state.dailySteps
        newBaseline = cumulative
    }

    // A negative delta here means the caller decided this was NOT a reset, so the
    // reading is untrustworthy — hold the previous total rather than emitting a
    // negative or wildly wrong count.
    if (cumulative < newBaseline) {
        return StepResult(state.baseline, state.dailySteps, state.rebootOffset)
    }

    val newDailySteps = ((cumulative - newBaseline) + newRebootOffset)
        .coerceIn(0L, MAX_SANE_DAILY_STEPS.toLong())
        .toInt()

    return StepResult(newBaseline, newDailySteps, newRebootOffset)
}

/**
 * Decides which baseline a new day should start from.
 *
 * ## The problem
 *
 * `dailySteps = (cumulative - baseline) + rebootOffset`, so the midnight reset has
 * to move `baseline` up to the hardware counter's value AT the day boundary. Every
 * reset path used to do `baseline = lastCumulative` unconditionally, and
 * `lastCumulative` is only as fresh as the last sensor event we accepted.
 *
 * When the service is killed in the evening — routine on aggressive OEMs — that
 * reading is hours old:
 *
 *   20:00  service dies, lastCumulative = 100,000
 *   20:00–00:00  user walks 3,000 steps; hardware counts them, we do not see them
 *   00:05  reset runs, baseline = 100,000
 *   00:10  first event reports 103,000 → dailySteps = 3,000
 *
 * Yesterday evening's steps open the new day. That is a real inflation vector and
 * it is invisible in the JS layer, because as far as the app is concerned the
 * sensor genuinely reports 3,000 steps for today.
 *
 * ## Why the heartbeat is the right signal, and elapsed time is not
 *
 * An old reading is not automatically a wrong one. The sensor only emits while the
 * user moves, so if someone sat still from 22:00 to midnight, a 22:00 reading is
 * still exactly equal to the counter at midnight and is perfectly safe to use.
 *
 * What matters is not how old the reading is but whether we were LISTENING the
 * whole time. The service writes a heartbeat every 60s while alive, so:
 *
 *   heartbeat fresh → we were listening; no events means no steps; reading is exact
 *   heartbeat stale → we were dead; steps may have been walked unseen; reading is
 *                     not usable as a boundary value
 *
 * ## Cost of the fallback
 *
 * Returning 0 makes the next sensor event re-seed the baseline from the live
 * counter, which discards steps taken between midnight and that first event. Those
 * are near zero in the case this applies to (service dead overnight), and the
 * alternative is starting the day with yesterday's total already on the clock.
 *
 * @param lastCumulative  last accepted TYPE_STEP_COUNTER reading.
 * @param heartbeatAtMs   epoch ms of the service's last heartbeat, 0 if never.
 * @param nowMs           current epoch ms.
 * @param heartbeatStaleMs age beyond which the service is considered to have died.
 * @return the baseline to store, or 0 meaning "re-initialise from the next event".
 */
fun resolveMidnightBaseline(
    lastCumulative: Long,
    heartbeatAtMs: Long,
    nowMs: Long,
    heartbeatStaleMs: Long,
): Long {
    if (lastCumulative <= 0L) return 0L
    if (heartbeatAtMs <= 0L) return 0L
    if (nowMs - heartbeatAtMs > heartbeatStaleMs) return 0L
    return lastCumulative
}
