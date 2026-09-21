// src/utils/sharedStepSource.js
//
// One step counter, several accounts.
//
// ── The incident ────────────────────────────────────────────────────────────
//
// Two accounts, created months apart, on two installs of the app with
// different installIds, both reporting from a Xiaomi 23049PCD8I on build 81.
// On 21 Sep their foreground-service streams posted the SAME daily totals at
// the SAME instants — 475 at 02:14:53.7, 500 at 02:29:56.6, 2,560 at
// 02:44:57.7, 4,800 at 03:00:01.0 … 30,000 at 13:32:41.8 — thirty-six syncs,
// identical to the step, with arrival times 3 to 55 milliseconds apart. Both
// days closed at the account roof and both accounts were paid for every step.
//
// Nothing in stepValidation.js can see this, and nothing there could be made
// to. Every rule it has judges one account's figures against physiology or
// against that account's own history, and a counter that is genuine on one
// phone is exactly as genuine on its clone: the two streams pass or fail every
// rule identically. The only evidence is the coincidence itself. Two people do
// not reach the same total, to the step, at the same moment, several times in
// a day — unless they are reading the same hardware.
//
// The mechanism is ordinary. Android app cloning — Xiaomi "Dual apps", Samsung
// "Dual Messenger", a work profile — runs a second copy of the app under its
// own Android user. That copy has its own installId (ANDROID_ID is per
// profile), its own Health Connect, its own SharedPreferences, and the same
// TYPE_STEP_COUNTER, because the sensor belongs to the phone. Both copies
// re-baseline at midnight from the same counter and post the same daily total
// on the same 15-minute tick. Sign each copy into a different account and one
// phone is paid twice. It does not need a modified app, and it does not need
// the steps to be faked: an honest day's walking is paid once per account.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// Every sample a stream produces — a gain of at least STUCK_DELTA_MIN_STEPS,
// the same unit the cadence rules use — is written to the day's row as
// (total, at) and indexed by date and total. On each new sample, the other
// rows on that date holding any of this account's recent totals are read, and
// the two histories compared. A MATCH is the same total, of at least
// SHARED_MIN_STEPS, arriving within SHARED_MATCH_WINDOW_MIN of when this
// account posted it. SHARED_MIN_MATCHES of them, and the two accounts share
// a counter.
//
// The time window is what keeps this from ever firing by chance. Two accounts
// posting the same total on the same day is not rare — a few thousand active
// users spread over a few thousand possible totals collide constantly, and
// requiring several shared totals only slows the collisions down. Requiring
// each shared total to have ARRIVED within the same three-minute window
// multiplies every one of them by 4/1440, and two of those together are a
// coincidence that will not happen across the whole user base in a year.
//
// Two matches rather than one, because a single one can still be produced by a
// pair of real users who both cross, say, 1,200 steps at 08:31. And two rather
// than three, because of how the copies post: their syncs land tens of
// milliseconds apart, so neither request can see the other's CURRENT figure —
// it has not been written yet — and the match is made on the previous samples,
// which are fifteen minutes old and long since committed. The verdict is
// therefore reached at the third shared sample, from the two before it.
//
// ── Who keeps the steps ─────────────────────────────────────────────────────
//
// The older account, by the creation time carried in its ObjectId. The newer
// is held for the rest of the day, graded 'shared_source', and flagged.
//
// Older rather than "whichever posted first", because the copies post within
// milliseconds and first-to-arrive would flip every sync — each account paid
// on alternate ticks, which refuses nothing. Older rather than both, because a
// phone genuinely walked its steps and one account should be paid for them;
// holding both would punish a real day of walking for the sake of the copy.
// And older rather than newer, because it cannot be gamed by creating
// accounts: every new account made to claim a counter is by construction the
// newer one, and loses.
//
// A family sharing one phone and two accounts lands here too, and under this
// rule the second account's steps are refused. That is the intended reading of
// one phone, one payout — the steps were walked once — and the row says which
// account they were credited to, so support can say so.
//
// ── For the rest of the day ─────────────────────────────────────────────────
//
// Once held, held until midnight. A shared counter is a fact about the phone,
// not about the sample that revealed it, and releasing on the first sample
// that fails to match would hand the copy every sync on which the older
// account happened to post late. The row carries the other account, the match
// count and when the hold began, so the finding is visible and reversible.

const HealthActivity = require('../models/HealthActivity.model');

/** A total below this is not compared: small totals are where honest collisions live. */
const SHARED_MIN_STEPS = 1_000;
/** Minutes apart two accounts may post the same total and still be one counter. */
const SHARED_MATCH_WINDOW_MIN = 3;
/** Shared totals needed, each inside the window, before the day is judged shared. */
const SHARED_MIN_MATCHES = 2;
/** Of this account's own samples, how many recent ones are compared. */
const SHARED_RECENT_SAMPLES = 8;
/** Sample totals kept per row per day, oldest dropped first. */
const MAX_SAMPLE_TOTALS = 256;
/** Rows read per check. Two copies is the case; more is the same finding. */
const MAX_CANDIDATE_ROWS = 5;

const ms = (v) => (v == null ? null : new Date(v).getTime());

/**
 * When an account was created, from the timestamp every ObjectId carries in
 * its first four bytes. Accepts an ObjectId or its hex string.
 */
function accountCreatedMs(id) {
  const hex = String(id ?? '');
  if (!/^[0-9a-fA-F]{24}$/.test(hex)) return null;
  return parseInt(hex.slice(0, 8), 16) * 1000;
}

/**
 * Is `a` the newer of the two accounts? Ties — two accounts created in the
 * same second — fall to the hex order, so the answer is total and stable.
 */
function isNewerAccount(a, b) {
  const ta = accountCreatedMs(a);
  const tb = accountCreatedMs(b);
  if (ta != null && tb != null && ta !== tb) return ta > tb;
  return String(a) > String(b);
}

/**
 * How many of `mine` appear in `theirs` at the same total and the same time.
 * Each of theirs is spent on at most one of mine, so a re-sent figure cannot
 * count twice.
 *
 * @param {Array<{total: number, at: number|Date}>} mine
 * @param {Array<{total: number, at: number|Date}>} theirs
 * @returns {number}
 */
function countSharedSamples(mine, theirs) {
  const window = SHARED_MATCH_WINDOW_MIN * 60_000;
  const pool = (theirs || [])
    .map((s) => ({ total: Math.round(Number(s?.total)), at: ms(s?.at) }))
    .filter((s) => Number.isFinite(s.total) && s.total >= SHARED_MIN_STEPS && s.at != null);

  let matches = 0;
  for (const raw of mine || []) {
    const total = Math.round(Number(raw?.total));
    const at = ms(raw?.at);
    if (!Number.isFinite(total) || total < SHARED_MIN_STEPS || at == null) continue;
    const i = pool.findIndex((s) => s.total === total && Math.abs(s.at - at) <= window);
    if (i === -1) continue;
    pool.splice(i, 1);
    matches += 1;
  }
  return matches;
}

/**
 * Judges whether this account's day shares a counter with another's.
 *
 * Pure, and takes already-loaded rows, so the policy is testable without a
 * database. The caller reads the candidates with loadSharedSourceCandidates
 * and persists what comes back on the day's row.
 *
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.userId - The account syncing now.
 * @param {Array<{total: number, at: number|Date}>} params.mine - This account's
 *   recent sample totals today, INCLUDING the one arriving now.
 * @param {Array<{user: any, sampleTotals: Array<{total: number, at: number|Date}>}>} params.candidates
 *   Other accounts' rows for the same date.
 * @returns {{ shared: boolean, held: boolean, otherUser: any, matches: number, reason: string|null }}
 */
function resolveSharedSource({ userId, mine, candidates }) {
  let best = null;
  for (const row of candidates || []) {
    if (!row?.user || String(row.user) === String(userId)) continue;
    const matches = countSharedSamples(mine, row.sampleTotals);
    if (matches >= SHARED_MIN_MATCHES && (best == null || matches > best.matches)) {
      best = { otherUser: row.user, matches };
    }
  }
  if (!best) return { shared: false, held: false, otherUser: null, matches: 0, reason: null };

  const held = isNewerAccount(userId, best.otherUser);
  return {
    shared: true,
    held,
    otherUser: best.otherUser,
    matches: best.matches,
    reason: describeSharedSource({ otherUser: best.otherUser, matches: best.matches, held }),
  };
}

/** The sentence the validator, the sync log and the cheat flag all carry. */
function describeSharedSource({ otherUser, matches, held }) {
  return (
    `Step counter shared with account ${otherUser}: the same totals arrived ` +
    `from both within ${SHARED_MATCH_WINDOW_MIN} minutes of each other ` +
    `${matches} times today` +
    (held
      ? ' — steps credited to the older account, this one held for the day'
      : ' — this is the older account and keeps the steps')
  );
}

/**
 * Other accounts' rows on this date that hold any of these totals. Indexed on
 * {date, sampleTotals.total}, so the read is a handful of index hits however
 * many users synced that day.
 *
 * Never throws: a failed read means "no evidence", and the sync goes on.
 */
async function loadSharedSourceCandidates({ userId, date, totals }) {
  const wanted = [...new Set((totals || []).map((t) => Math.round(Number(t))))].filter(
    (t) => Number.isFinite(t) && t >= SHARED_MIN_STEPS,
  );
  if (!wanted.length) return [];
  try {
    return await HealthActivity.find({
      date,
      user: { $ne: userId },
      'sampleTotals.total': { $in: wanted },
    })
      .select('user sampleTotals')
      .limit(MAX_CANDIDATE_ROWS)
      .lean();
  } catch (err) {
    console.error('[SharedSource] candidate read failed:', err?.message || err);
    return [];
  }
}

module.exports = {
  resolveSharedSource,
  countSharedSamples,
  describeSharedSource,
  isNewerAccount,
  accountCreatedMs,
  loadSharedSourceCandidates,
  SHARED_MIN_STEPS,
  SHARED_MATCH_WINDOW_MIN,
  SHARED_MIN_MATCHES,
  SHARED_RECENT_SAMPLES,
  MAX_SAMPLE_TOTALS,
};
