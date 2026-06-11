package com.athlofit

/**
 * Pure data class representing the current step counter state.
 *
 * @property baseline Sensor value at start of day or after last reboot detection
 * @property dailySteps Calculated as (cumulative - baseline) + rebootOffset
 * @property rebootOffset Accumulated steps from before the last detected reboot
 * @property hasReceivedFirstEvent Whether the service has received at least one sensor event
 */
data class StepState(
    val baseline: Long,
    val dailySteps: Int,
    val rebootOffset: Int,
    val hasReceivedFirstEvent: Boolean
)

/**
 * Pure data class representing the result of a step calculation.
 *
 * @property baseline Updated baseline (changes only on true reboot detection)
 * @property dailySteps Updated daily step count
 * @property rebootOffset Updated reboot offset (increases only on true reboot detection)
 */
data class StepResult(
    val baseline: Long,
    val dailySteps: Int,
    val rebootOffset: Int
)

/**
 * Pure function that calculates step count from sensor state.
 *
 * Reboot detection uses strict less-than (`<`) to avoid false positives
 * when the service restarts and cumulative equals baseline (no new steps).
 * A true device reboot resets the cumulative counter to near-zero, which
 * will always be strictly less than the persisted baseline.
 *
 * @param state The current step counter state
 * @param cumulative The cumulative step count from the TYPE_STEP_COUNTER sensor
 * @return The updated step calculation result
 */
fun calculateSteps(state: StepState, cumulative: Long): StepResult {
    var newBaseline = state.baseline
    var newDailySteps = state.dailySteps
    var newRebootOffset = state.rebootOffset

    // Reboot detection: only when cumulative is strictly less than baseline
    if (cumulative < newBaseline && state.hasReceivedFirstEvent) {
        newRebootOffset += newDailySteps
        newBaseline = cumulative
        newDailySteps = 0
    }

    // Calculate daily steps
    newDailySteps = (cumulative - newBaseline).toInt() + newRebootOffset

    return StepResult(newBaseline, newDailySteps, newRebootOffset)
}
