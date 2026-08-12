package com.athlofit

import io.kotest.core.spec.style.StringSpec
import io.kotest.matchers.shouldBe

/**
 * Tests for the pure step arithmetic.
 *
 * Both functions here decide numbers that no layer above can sanity-check: the app
 * only ever sees the OUTPUT of these, so a wrong result looks exactly like the user
 * genuinely having walked that far. That is what made the historical inflation so
 * hard to trace, and why the rules are pinned here.
 */
class StepCalculatorTest : StringSpec({

    val HEARTBEAT_STALE = 5 * 60 * 1000L
    val NOW = 1_700_000_000_000L

    // ── calculateSteps ────────────────────────────────────────────────────────

    "counts steps above the baseline" {
        val result = calculateSteps(StepState(baseline = 1000, dailySteps = 0, rebootOffset = 0), 1500, false)
        result.dailySteps shouldBe 500
        result.baseline shouldBe 1000
        result.rebootOffset shouldBe 0
    }

    "carries the day's total into the offset on a confirmed reset" {
        // Reboot: the hardware counter restarts at 0, so today's steps so far have to
        // survive somewhere. That somewhere is rebootOffset.
        val result = calculateSteps(StepState(baseline = 90_000, dailySteps = 4_000, rebootOffset = 0), 20, true)
        result.rebootOffset shouldBe 4_000
        result.baseline shouldBe 20
        result.dailySteps shouldBe 4_000
    }

    "holds the previous total when a reading dips below the baseline without a confirmed reset" {
        // A single below-baseline reading is a HAL glitch. Treating it as a reset was
        // the original inflation bug: every glitch folded the day into rebootOffset
        // again, so the total crept up a little each time.
        val state = StepState(baseline = 1000, dailySteps = 500, rebootOffset = 0)
        val result = calculateSteps(state, 20, false)
        result shouldBe StepResult(1000, 500, 0)
    }

    "never grows the offset unless the caller confirms a reset" {
        var state = StepState(baseline = 1000, dailySteps = 500, rebootOffset = 0)
        repeat(20) {
            val r = calculateSteps(state, 10, false)
            state = StepState(r.baseline, r.dailySteps, r.rebootOffset)
        }
        state.rebootOffset shouldBe 0
        state.dailySteps shouldBe 500
    }

    "clamps to the sane daily maximum" {
        val result = calculateSteps(StepState(baseline = 0, dailySteps = 0, rebootOffset = 0), 5_000_000, false)
        result.dailySteps shouldBe MAX_SANE_DAILY_STEPS
    }

    "uses the same 100k ceiling as the app and the server" {
        MAX_SANE_DAILY_STEPS shouldBe 100_000
    }

    // ── resolveMidnightBaseline ───────────────────────────────────────────────

    "seeds the new day from the last reading when the service was alive" {
        // Heartbeat one minute old — we were listening, so no events means no steps
        // and the reading is exactly the counter value at the boundary.
        resolveMidnightBaseline(
            lastCumulative = 100_000,
            heartbeatAtMs = NOW - 60_000,
            nowMs = NOW,
            heartbeatStaleMs = HEARTBEAT_STALE,
        ) shouldBe 100_000
    }

    "discards the last reading when the service had died" {
        // Killed hours ago: the hardware kept counting, we did not see it, so this
        // reading predates steps that are NOT part of the new day.
        resolveMidnightBaseline(
            lastCumulative = 100_000,
            heartbeatAtMs = NOW - 4 * 60 * 60 * 1000L,
            nowMs = NOW,
            heartbeatStaleMs = HEARTBEAT_STALE,
        ) shouldBe 0
    }

    "discards the last reading when there is no heartbeat at all" {
        // onDestroy clears the heartbeat, so 0 means a stop we cannot reason about.
        resolveMidnightBaseline(
            lastCumulative = 100_000,
            heartbeatAtMs = 0,
            nowMs = NOW,
            heartbeatStaleMs = HEARTBEAT_STALE,
        ) shouldBe 0
    }

    "returns 0 when no reading has ever been taken" {
        resolveMidnightBaseline(
            lastCumulative = 0,
            heartbeatAtMs = NOW,
            nowMs = NOW,
            heartbeatStaleMs = HEARTBEAT_STALE,
        ) shouldBe 0
    }

    "the evening-death scenario opens the new day at zero" {
        // End to end: service dies at 20:00 with the counter at 100,000, the user walks
        // 3,000 steps unobserved, the reset runs after midnight, then the first event
        // arrives reporting 103,000.
        val baseline = resolveMidnightBaseline(
            lastCumulative = 100_000,
            heartbeatAtMs = NOW - 4 * 60 * 60 * 1000L,
            nowMs = NOW,
            heartbeatStaleMs = HEARTBEAT_STALE,
        )
        baseline shouldBe 0

        // baseline == 0 is the "uninitialised" signal, so onSensorChanged re-seeds from
        // the live counter and the day starts at 0 rather than at yesterday's 3,000.
        val reseeded = calculateSteps(StepState(baseline = 103_000, dailySteps = 0, rebootOffset = 0), 103_000, false)
        reseeded.dailySteps shouldBe 0
    }
})
