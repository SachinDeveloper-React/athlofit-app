package com.athlofit

/**
 * StepOriginDedup
 *
 * Deduplicates Health Connect step records across data origins.
 *
 * Health Connect is a shared store: on a typical phone the Steps table holds
 * records from the platform pedometer, possibly Samsung Health or Google Fit,
 * and any third-party fitness app the user installed. Those sources overlap in
 * two very different ways, and telling them apart is the whole job here:
 *
 *   * Samsung Health and the platform sensor record THE SAME walk. Adding them
 *     roughly doubles the count.
 *   * A phone and a paired watch record DIFFERENT periods. Taking the max of
 *     them throws away real steps.
 *
 * The distinguishing signal is TIME. Two origins that were recording at the same
 * moments are describing the same steps; two origins that recorded at different
 * moments are describing different steps. So the origin with the highest total
 * becomes the baseline, and any other origin is added only in proportion to the
 * recording time it does NOT share with that baseline.
 *
 * ── Why this replaced max() ──────────────────────────────────────────────────
 *
 * This worker used to take `stepsByOrigin.values.maxOrNull()`, which never
 * inflates but silently drops a paired watch's steps. The JS reader meanwhile
 * ran a time-slot dedup that could over-report by ~1.7x, and the two posted
 * different totals for the same day. The server keeps the higher figure
 * (`max(validatedSteps, previousWalked)`), so every disagreement resolved in
 * favour of the larger number — the inflated one. Running one algorithm in both
 * readers removes that asymmetry; see healthConnect.service.ts for the matching
 * implementation and the full history.
 *
 * Pure and deterministic: same records in, same number out. No clock, no I/O.
 */
object StepOriginDedup {

    /**
     * How much of an origin's recording time must fall OUTSIDE the primary
     * source's before we believe it is an independent device rather than a
     * mirror.
     *
     * Set high deliberately. Mistaking a mirror for a second device inflates the
     * count and mints step coins for steps nobody walked; mistaking a second
     * device for a mirror loses some steps for a user who owns two. Only the
     * first costs real money, so a partial overlap resolves to "mirror".
     */
    private const val DISJOINT_COVERAGE_MIN = 0.9

    /**
     * Minimum span given to a zero-length record when measuring coverage. Some
     * writers log instantaneous records; without this they would have no
     * coverage at all and could never be judged disjoint.
     */
    private const val MIN_RECORD_SPAN_MS = 60_000L

    /**
     * A half-open time span [start, end) in epoch milliseconds.
     *
     * Deliberately not LongRange: `a until b` makes `last` equal `b - 1`, so
     * every duration computed from it is off by one millisecond and the merge
     * comparison shifts by one. A span with explicit ends keeps the arithmetic
     * obvious.
     */
    private data class Span(val start: Long, val end: Long) {
        val durationMs: Long get() = end - start
    }

    /** One step record, reduced to the fields the dedup reasons about. */
    data class Record(
        val origin: String,
        val count: Long,
        /** Epoch milliseconds. */
        val start: Long,
        /** Epoch milliseconds. */
        val end: Long,
    )

    data class Contribution(
        val packageName: String,
        val steps: Long,
        /** Fraction of this origin's recording time not shared with the primary. */
        val disjointFraction: Double,
        /** Steps this origin actually added on top of the primary. */
        val contributed: Long,
    )

    data class Result(
        val steps: Long,
        /** Biggest single origin's total. Diagnostic — see `primaryTotal`. */
        val largestOrigin: Long,
        val originSum: Long,
        val primaryOrigin: String,
        /**
         * The PRIMARY origin's own total, which is the baseline `steps` is built
         * on. Equal to `largestOrigin` unless origin stickiness demoted a larger
         * but unestablished source — see the note at `resolve`.
         */
        val primaryTotal: Long,
        val contributions: List<Contribution>,
    ) {
        /** One-line summary for the sync log. */
        fun describe(): String {
            if (primaryOrigin.isEmpty()) return "no records"
            val added = contributions.filter { it.contributed > 0 }
                .joinToString { "${it.packageName} +${it.contributed}" }
            val mirrored = contributions.filter { it.contributed == 0L }
                .joinToString { "${it.packageName} (${it.steps}, ${(it.disjointFraction * 100).toInt()}% disjoint)" }
            return buildString {
                append("primary=$primaryOrigin $primaryTotal")
                if (primaryTotal != largestOrigin) {
                    append(" (demoted a larger unestablished origin: $largestOrigin)")
                }
                if (added.isNotEmpty()) append(", added $added")
                if (mirrored.isNotEmpty()) append(", mirrors: $mirrored")
                append(", raw sum would be $originSum")
            }
        }
    }

    /**
     * Resolves a deduplicated step total.
     *
     * Guarantees, by construction:
     *   * `steps >= primaryTotal` — the origin the total is built on genuinely
     *     recorded that many, so the total can never fall below it.
     *   * `steps <= originSum` — a deduplicated total is a subset of the raw sum.
     *
     * ── Why `establishedOrigins` exists ─────────────────────────────────────
     *
     * "Primary" used to mean nothing but "the origin with the highest count", and
     * that is a rule about size in a store anything on the phone can write to.
     * A step-spoofing app installs under a generated package name, writes a large
     * number of records, and is handed the baseline by definition — at which
     * point everything the user actually walked, recorded by a real app, is
     * measured against the injected timeline, judged a mirror of it, and
     * contributes zero. One account's genuine 2,101 steps from Google Fit were
     * discarded in favour of an injected 5,522 in exactly that way.
     *
     * So an origin the phone has actually been using outranks a larger one it has
     * not. `establishedOrigins` is that set, kept by StepOriginHistory across
     * days; passing an empty set is the old behaviour exactly.
     *
     * The demotion is deliberately narrow, because being wrong here costs a real
     * user their steps:
     *
     *   * It only applies when at least one established origin is actually
     *     present today. Someone who switches fitness apps outright has no
     *     established origin left in the data, falls through to the old rule, and
     *     is unaffected.
     *   * A demoted origin is not discarded. It goes through the same coverage
     *     test as any other non-primary source, so a genuinely new device — a
     *     watch recording periods the phone did not — still contributes every
     *     step it can show independent recording time for. What it loses is only
     *     the right to define the baseline.
     *
     * Still pure: the set is passed in, not read from disk here.
     */
    fun resolve(records: List<Record>, establishedOrigins: Set<String> = emptySet()): Result {
        if (records.isEmpty()) return Result(0, 0, 0, "", 0, emptyList())

        val totals = HashMap<String, Long>()
        val intervals = HashMap<String, MutableList<Span>>()

        for (r in records) {
            val count = r.count.coerceAtLeast(0)
            totals[r.origin] = (totals[r.origin] ?: 0L) + count
            // A record with no steps is not evidence that its origin was
            // recording — an empty all-day row must not claim the whole day.
            if (count == 0L) continue
            intervals.getOrPut(r.origin) { mutableListOf() }
                .add(Span(r.start, maxOf(r.end, r.start)))
        }

        if (totals.isEmpty()) return Result(0, 0, 0, "", 0, emptyList())

        val originSum = totals.values.sum()
        val largestOrigin = totals.values.max()

        // Prefer an origin this phone has been using. Falls back to every origin
        // when none of today's are established, which is both the old behaviour
        // and the right answer for a genuine first run or an app switch.
        val candidates = totals.keys.filter { it in establishedOrigins }
            .ifEmpty { totals.keys.toList() }
        val baselineTotal = candidates.maxOf { totals.getValue(it) }

        // Ties broken by package name so the result does not depend on the order
        // Health Connect happened to return records in.
        val primaryOrigin = candidates
            .filter { totals.getValue(it) == baselineTotal }
            .min()

        val coverage = totals.keys.associateWith { merge(intervals[it] ?: emptyList()) }
        val primaryCoverage = coverage.getValue(primaryOrigin)

        var extras = 0L
        val contributions = mutableListOf<Contribution>()

        for (origin in totals.keys.sorted()) {
            if (origin == primaryOrigin) continue

            val own = coverage.getValue(origin)
            val ownMs = own.sumOf { it.durationMs }
            // No measurable coverage means no evidence of independence.
            val disjointFraction =
                if (ownMs > 0) 1.0 - intersectionMs(own, primaryCoverage).toDouble() / ownMs
                else 0.0

            val contributed =
                if (disjointFraction >= DISJOINT_COVERAGE_MIN)
                    Math.round(totals.getValue(origin) * disjointFraction)
                else 0L

            extras += contributed
            contributions.add(
                Contribution(origin, totals.getValue(origin), disjointFraction, contributed)
            )
        }

        return Result(
            // Built on the PRIMARY's total, not the largest. When stickiness has
            // demoted a bigger unestablished origin, using the larger figure here
            // would hand the injected count straight back as a floor and undo the
            // demotion entirely.
            steps = minOf(originSum, baselineTotal + extras),
            largestOrigin = largestOrigin,
            originSum = originSum,
            primaryOrigin = primaryOrigin,
            primaryTotal = baselineTotal,
            contributions = contributions,
        )
    }

    /**
     * Steps per local hour of the day starting at `dayStartMs`, index 0 = 00:00.
     *
     * The counterpart of `bucketStepsByHour` in healthConnect.service.ts, and it
     * has to stay the counterpart: both readers post to the same endpoint and
     * write to the same per-day attribution ledger, so two different hour
     * attributions would put contradictory histograms on one day.
     *
     * A Health Connect record is a COUNT OVER A SPAN, not a stamp at an instant,
     * so a record covering 08:40–09:20 is split between the two hours in
     * proportion to the time it spends in each. Crediting it whole to the hour it
     * starts in would collapse a long bulk record into a single hour — which is
     * precisely the shape this histogram exists to tell apart from a genuine
     * all-day walk.
     *
     * Pass only the records that were actually COUNTED. Including a mirrored
     * origin makes the hours sum to roughly double the deduplicated total they
     * are meant to describe.
     */
    fun bucketByHour(records: List<Record>, dayStartMs: Long): IntArray {
        val hours = IntArray(24)
        val msPerHour = 3_600_000L

        for (r in records) {
            val count = r.count.coerceAtLeast(0)
            if (count == 0L) continue

            val start = r.start
            val end = maxOf(r.end, r.start)
            val span = end - start

            // A zero-length record has no span to divide, so it is credited whole
            // to the hour it sits in rather than dropped.
            if (span <= 0) {
                val h = ((start - dayStartMs) / msPerHour).toInt()
                if (h in 0..23) hours[h] += count.toInt()
                continue
            }

            val firstHour = maxOf(0L, (start - dayStartMs) / msPerHour).toInt()
            val lastHour = minOf(23L, (end - dayStartMs) / msPerHour).toInt()

            for (h in firstHour..lastHour) {
                val hourStart = dayStartMs + h * msPerHour
                val overlap = minOf(end, hourStart + msPerHour) - maxOf(start, hourStart)
                if (overlap > 0) hours[h] += Math.round(count.toDouble() * overlap / span).toInt()
            }
        }

        return hours
    }

    /** Sorts and merges overlapping spans into a disjoint, ascending set. */
    private fun merge(spans: List<Span>): List<Span> {
        if (spans.isEmpty()) return emptyList()
        val sorted = spans
            .map { Span(it.start, maxOf(it.end, it.start + MIN_RECORD_SPAN_MS)) }
            .sortedBy { it.start }

        val merged = mutableListOf<Span>()
        var current = sorted.first()
        for (i in 1 until sorted.size) {
            val next = sorted[i]
            current = if (next.start <= current.end) {
                Span(current.start, maxOf(current.end, next.end))
            } else {
                merged.add(current)
                next
            }
        }
        merged.add(current)
        return merged
    }

    /** Milliseconds present in BOTH disjoint, ascending span sets. */
    private fun intersectionMs(a: List<Span>, b: List<Span>): Long {
        var i = 0
        var j = 0
        var sum = 0L
        while (i < a.size && j < b.size) {
            val lo = maxOf(a[i].start, b[j].start)
            val hi = minOf(a[i].end, b[j].end)
            if (hi > lo) sum += hi - lo
            if (a[i].end < b[j].end) i++ else j++
        }
        return sum
    }
}
