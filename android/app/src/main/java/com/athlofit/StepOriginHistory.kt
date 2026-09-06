package com.athlofit

import android.content.Context
import org.json.JSONObject
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * StepOriginHistory
 *
 * Which Health Connect data origins this phone has actually been reading from,
 * across days.
 *
 * ── Why the dedup needs this ────────────────────────────────────────────────
 *
 * StepOriginDedup picks a baseline origin, and until this existed it picked the
 * one with the highest count. Health Connect is a shared store: any app can
 * write to it, so "highest count" is a rule a step-spoofing app satisfies by
 * definition. It installs under a package name generated at install time, writes
 * a large number of records, becomes the baseline, and every genuinely walked
 * step recorded by a real app is then measured against the injected timeline and
 * judged a duplicate of it.
 *
 * What separated the fraudulent accounts from the honest ones was not the
 * package name — the one suspicious-looking pattern turned out to be the
 * platform pedometer on most of the phones that had it — but ROTATION. An honest
 * phone reads from the same one or two origins for weeks. A spoofer reinstalls
 * under a fresh name every few days.
 *
 * So this keeps a count of distinct days each origin has been seen on, and the
 * dedup prefers origins that have been around. The server keeps the matching
 * rule in utils/stepOriginTrust.js, over its own record of what was reported,
 * for the case where this file is not the one running.
 *
 * ── Shape of the data ───────────────────────────────────────────────────────
 *
 * `{ "<package>": { "days": 7, "last": "2026-09-04" }, ... }` in SharedPreferences.
 *
 * Days, not sightings. The widget worker reads Health Connect every 15 minutes,
 * so counting sightings would let one afternoon establish an origin outright —
 * which is exactly the thing being defended against. `last` is what makes a day
 * count once: an origin already recorded today is not recorded again.
 *
 * Entries are dropped once they have not been seen for RETENTION_DAYS, so an app
 * the user actually uninstalled stops outranking its replacement forever.
 */
object StepOriginHistory {

    private const val PREFS_NAME = "StepOriginHistory"
    private const val KEY_ORIGINS = "origins"

    /**
     * Distinct days an origin must be seen on before the dedup will prefer it.
     *
     * Three, matching ORIGIN_TRUST_MIN_DAYS on the server. Short enough that a
     * new phone or a genuine app switch settles within a few days, long enough
     * that an origin present for only a day or two — a reinstalled spoofer —
     * never establishes before it rotates again.
     */
    private const val ESTABLISH_MIN_DAYS = 3

    /** Days without a sighting after which an origin is forgotten. */
    private const val RETENTION_DAYS = 60

    /**
     * Cap on tracked origins, so a device being flooded with generated package
     * names cannot grow this without bound. Well above what a real phone has:
     * the honest accounts examined had one or two.
     */
    private const val MAX_TRACKED = 32

    /**
     * Drops the least-established entry. Returns false when there is nothing to
     * drop, which cannot happen at capacity but keeps the caller honest.
     */
    private fun evictWeakest(json: JSONObject): Boolean {
        var weakestKey: String? = null
        var weakestDays = Int.MAX_VALUE
        var weakestLast = "9999-99-99"
        for (key in json.keys().asSequence().toList()) {
            val entry = json.optJSONObject(key) ?: continue
            val days = entry.optInt("days", 0)
            val last = entry.optString("last", "")
            if (days < weakestDays || (days == weakestDays && last < weakestLast)) {
                weakestKey = key
                weakestDays = days
                weakestLast = last
            }
        }
        weakestKey?.let { json.remove(it) }
        return weakestKey != null
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private fun today(): String =
        LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

    private fun read(context: Context): JSONObject =
        try {
            JSONObject(prefs(context).getString(KEY_ORIGINS, "{}") ?: "{}")
        } catch (e: Exception) {
            // Corrupt blob. Starting empty costs a few days of stickiness and is
            // strictly better than throwing on the sync path.
            JSONObject()
        }

    /**
     * Origins this phone has been reading from for long enough to be believed.
     *
     * An empty set is a normal, safe answer — StepOriginDedup falls back to its
     * old size-based rule — so a fresh install is not penalised.
     */
    @JvmStatic
    fun established(context: Context): Set<String> {
        val json = read(context)
        val out = mutableSetOf<String>()
        for (key in json.keys()) {
            val entry = json.optJSONObject(key) ?: continue
            if (entry.optInt("days", 0) >= ESTABLISH_MIN_DAYS) out.add(key)
        }
        return out
    }

    /**
     * Records that these origins were seen today.
     *
     * Call with the origins actually READ from Health Connect, not only the one
     * that won: an origin has to accumulate days before it can ever be preferred,
     * and it can only do that while it is being demoted.
     *
     * Idempotent within a day — the widget worker calling this ninety times
     * advances each origin by one day, not ninety.
     */
    @JvmStatic
    fun recordSeen(context: Context, origins: Collection<String>) {
        if (origins.isEmpty()) return
        val json = read(context)
        val today = today()
        var changed = false

        // ── Prune BEFORE inserting ──────────────────────────────────────────
        // Order matters, and the first version had it backwards. Inserting first
        // and pruning after meant a device being flooded with generated package
        // names filled the map, and every genuine origin after that was silently
        // refused — permanently, since an origin that is never recorded can never
        // accumulate days and so can never become established. The defence would
        // have been switched off on exactly the devices that needed it.
        val cutoff = LocalDate.now().minusDays(RETENTION_DAYS.toLong()).toString()
        for (key in json.keys().asSequence().toList()) {
            val last = json.optJSONObject(key)?.optString("last") ?: ""
            if (last < cutoff) {
                json.remove(key)
                changed = true
            }
        }

        for (origin in origins.distinct()) {
            if (origin.isBlank()) continue
            val entry = json.optJSONObject(origin)
            if (entry != null) {
                if (entry.optString("last") == today) continue
                entry.put("days", entry.optInt("days", 0) + 1)
                entry.put("last", today)
                changed = true
                continue
            }
            // At capacity: evict the weakest entry rather than refusing the new
            // one. Fewest days first, oldest sighting as the tie-break, so a
            // one-day identity is always what goes and a real app — present every
            // day — is never the thing displaced. A flood of generated names now
            // evicts itself instead of locking everyone else out.
            if (json.length() >= MAX_TRACKED && !evictWeakest(json)) continue
            json.put(origin, JSONObject().put("days", 1).put("last", today))
            changed = true
        }

        if (changed) {
            prefs(context).edit().putString(KEY_ORIGINS, json.toString()).apply()
        }
    }
}
