package com.athlofit

/** Hard ceiling for a single day's step count (defensive clamp). */
const val MAX_SANE_DAILY_STEPS = 200_000

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
