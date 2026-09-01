import { useMutation, useQueryClient } from '@tanstack/react-query';
import notifee, { AndroidImportance, AndroidColor } from '@notifee/react-native';
import { Platform } from 'react-native';
import { getTimezone } from '../../../utils/timezone';
import { getLocalToday } from '../../../utils/date';
import { healthService } from '../service/health.service';
import { isStepTrackingEnabled } from '../../../store/stepTrackingStore';
import { useGamificationStore } from '../store/gamificationStore';
import type { HealthData } from '../types/healthTypes';
import { useStepDebugStore } from '../store/stepDebugStore';
import { useHealthDataStore } from '../store/healthDataStore';
import {
  buildStepSource,
  offlineMinutesSince,
  type StepSourcePayload,
} from '../service/stepProvenance';

// ─── Channel IDs ──────────────────────────────────────────────────────────────

const CHANNEL_STEP_GOAL  = 'step_goal';
const CHANNEL_CHALLENGES = 'challenges';

/**
 * How far below our own last reported figure a new figure must fall before it is
 * treated as a correction rather than normal source jitter. Matches
 * DECREASE_TOLERANCE in the backend's stepValidation.js.
 */
const STEP_CORRECTION_TOLERANCE = 100;

// ─── Setup channels once ──────────────────────────────────────────────────────

async function setupNotifChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    notifee.createChannel({
      id:          CHANNEL_STEP_GOAL,
      name:        'Step Goal Rewards',
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      lightColor:  AndroidColor.GREEN,
    }),
    notifee.createChannel({
      id:          CHANNEL_CHALLENGES,
      name:        'Challenge Rewards',
      importance:  AndroidImportance.HIGH,
      vibration:   true,
      lights:      true,
      lightColor:  AndroidColor.YELLOW,
    }),
  ]);
}

// ─── Notification helpers ─────────────────────────────────────────────────────

function androidConfig(channelId: string) {
  return {
    channelId,
    smallIcon:   'ic_notification',   // must match drawable/ic_notification.xml
    color:       '#0099FF',
    pressAction: { id: 'default' },
    importance:  AndroidImportance.HIGH,
  };
}

const iosConfig = {
  foregroundPresentationOptions: {
    alert: true,
    badge: false,
    sound: true,
  },
};

export async function showStepGoalNotification(coins: number): Promise<void> {
  try {
    await notifee.displayNotification({
      id:    'step_goal_reward',
      title: '🎉 Step Goal Reached!',
      body:  `You hit your daily step goal and earned ${coins} coins!`,
      android: androidConfig(CHANNEL_STEP_GOAL),
      ios:     iosConfig,
    });
  } catch (e) {
    console.warn('[Notifee] step goal notification failed:', e);
  }
}

export async function showChallengeNotifications(
  completed: { title: string; emoji: string; coinReward: number }[],
): Promise<void> {
  if (!completed.length) return;
  try {
    if (completed.length === 1) {
      const c = completed[0];
      await notifee.displayNotification({
        id:    `challenge_${Date.now()}`,
        title: `${c.emoji} Challenge Complete!`,
        body:  `"${c.title}" done — you earned ${c.coinReward} coins! 🪙`,
        android: androidConfig(CHANNEL_CHALLENGES),
        ios:     iosConfig,
      });
    } else {
      const totalCoins = completed.reduce((s, c) => s + c.coinReward, 0);
      const lines = completed.map(c => `${c.emoji} ${c.title} (+${c.coinReward} coins)`).join('\n');
      await notifee.displayNotification({
        id:    `challenges_${Date.now()}`,
        title: `🏆 ${completed.length} Challenges Complete!`,
        body:  `You earned ${totalCoins} coins!\n${lines}`,
        android: androidConfig(CHANNEL_CHALLENGES),
        ios:     iosConfig,
      });
    }
  } catch (e) {
    console.warn('[Notifee] challenge notification failed:', e);
  }
}

/**
 * Provenance for the step figure about to be synced.
 *
 * Reads the last resolution out of the debug store, which useHealth writes on
 * every resolve. Deliberately never throws and never blocks: this is an
 * explanation riding along with the sync, and a sync that carries real steps
 * must go out whether or not it can describe itself.
 *
 * ## Why the no-snapshot case is labelled rather than left empty
 *
 * This used to return undefined when the store held no snapshot yet, which sent
 * the sync with no `stepSource` block at all. The server's ledger records that
 * as `reader: 'unknown', method: null` — and `null` there is its signal for "a
 * build too old to report its step source". So a current build produced rows
 * indistinguishable from a stale one, pointing any investigation that found them
 * straight at the app version instead of at the real cause.
 *
 * The real cause is a race, and it is routine: on a cold open, `data` is hydrated
 * from the store and the throttle lets the session's first sync through before
 * the first resolve has run. One account shows it exactly — a `reader: 'unknown'`
 * row at 20:51:02, then a fully described Health Connect row 1.8 seconds later,
 * same build, same device.
 *
 * `method: 'pre-resolution'` says that in the ledger. The distinction is worth a
 * string: "the pipeline had not run yet" and "this build cannot tell you" have
 * completely different fixes.
 */
function buildSyncStepSource(): StepSourcePayload | undefined {
  try {
    const { lastSyncedAt } = useHealthDataStore.getState();
    const snapshot = useStepDebugStore.getState().snapshot;

    if (!snapshot) {
      const offlineMinutes = offlineMinutesSince(lastSyncedAt);
      return {
        reader: 'unknown',
        method: 'pre-resolution',
        origins: [],
        ...(offlineMinutes !== undefined ? { offlineMinutes } : {}),
      };
    }

    return buildStepSource({
      read: snapshot.stepRead,
      resolution: snapshot.resolution,
      lastSyncedAt,
    });
  } catch {
    return undefined;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSyncHealth() {
  const queryClient = useQueryClient();
  const setCoinsBalance = useGamificationStore(s => s.setCoinsBalance);

  const mutation = useMutation({
    mutationFn: (data: Partial<HealthData> & { date?: string; goalMet?: boolean }) => {
      // ── Step-tracking kill switch ───────────────────────────────────────────
      // The server rejects a step-carrying sync with 403 when tracking is
      // disabled for this account. Short-circuiting here avoids a guaranteed
      // failed request every sync tick — and, more importantly, keeps the
      // mutation's onError from surfacing a network-style failure for what is a
      // deliberate, already-communicated state.
      //
      // Only the step fields are dropped; a hydration-only payload still goes
      // through, because the switch pauses steps, not the rest of the app.
      if (!isStepTrackingEnabled() && typeof data.steps === 'number') {
        const { steps: _steps, ...withoutSteps } = data;
        const hasOtherData = Object.values(withoutSteps).some(
          v => v !== undefined && v !== null,
        );
        if (!hasOtherData) {
          // `skipped` so onSuccess can bail out. Its side effects assume a real
          // server response: the coin-block branch treats an absent
          // `data.coinBlocked` as "the block expired" and clears the local flag,
          // which on this synthetic response would hide the CoinBlockedBanner
          // for a user whose block is still active server-side.
          return Promise.resolve({
            success: true,
            message: 'Step tracking disabled',
            data: null,
            skipped: true,
          });
        }
        return healthService.syncHealthData({
          ...withoutSteps,
          timezone: getTimezone(),
        });
      }

      // ── Flag a downward correction ──────────────────────────────────────────
      // The server keeps the higher of stored and incoming steps, which is right
      // for multiple devices but meant an over-reported figure could never be
      // walked back: it stayed for the day and came back as the next login's
      // baseline. When this device is now reporting materially FEWER steps than it
      // itself last reported today, that is the self-heal case, and the server is
      // told to accept the decrease.
      //
      // Only ever lowers the stored count, so it is not exploitable.
      const { lastPushedSteps, lastPushedStepsDate } = useHealthDataStore.getState();
      const isCorrection =
        lastPushedStepsDate === getLocalToday() &&
        typeof data.steps === 'number' &&
        lastPushedSteps > 0 &&
        data.steps < lastPushedSteps - STEP_CORRECTION_TOLERANCE;

      if (isCorrection) {
        console.warn(
          `[SyncHealth] Reporting a step correction: ${lastPushedSteps} → ${data.steps}`,
        );
      }

      return healthService.syncHealthData({
        ...data,
        timezone: getTimezone(),
        ...(isCorrection ? { stepsCorrection: true } : {}),
        // ── Where this figure came from ─────────────────────────────────────
        // Attached only to payloads that actually carry steps: a hydration post
        // has no step source, and sending one would put rows in the attribution
        // ledger for syncs that moved no steps.
        //
        // Built from the last resolution rather than re-read, so what is
        // reported is the decision the pipeline actually made for the number
        // being sent — re-reading could describe a different figure than the one
        // in this payload, which is worse than sending nothing.
        ...(typeof data.steps === 'number' ? { stepSource: buildSyncStepSource() } : {}),
      });
    },

    onSuccess: (response: any, variables) => {
      // Nothing was sent, so there is no server state to reconcile against —
      // and reconciling against an empty response would actively undo correct
      // local state. See the `skipped` sentinel in mutationFn.
      if (response?.skipped) return;

      const d = response?.data;
      const today = getLocalToday();

      // ── Mark the device as having synced ────────────────────────────────────
      // Feeds `offlineMinutes` on the NEXT sync's provenance. Recorded on success
      // only, and for every successful sync rather than only step ones, because
      // what it measures is how long the device was unable to reach the server —
      // a hydration post that got through proves connectivity just as well.
      useHealthDataStore.getState().markSynced();

      // ── Record what this device pushed, for server echo detection ──────────
      // The app both writes and reads the server's step field, so on the next
      // login/refresh it can be handed back its own number. Remembering what we
      // sent lets stepEngine tell "another device added steps" (trust it) apart
      // from "this is our own value returning" (ignore it), which is what stops a
      // value from circulating between device and server and growing each lap.
      if (typeof variables?.steps === 'number' && variables.steps >= 0) {
        useHealthDataStore.getState().setLastPushedSteps(variables.steps, today);
      }

      // Always sync the server's coinsBalance to the local store.
      // The server is the single source of truth for balance — the frontend
      // only displays it, never independently accumulates.
      if (d?.coinsBalance !== undefined) {
        setCoinsBalance(d.coinsBalance);
      }

      // Sync coin block status from the sync response immediately.
      // This ensures the CoinBlockedBanner appears/disappears instantly when the
      // user's block status changes, without waiting for the gamification query.
      // - If coinBlocked is present (user is blocked): write it to store → banner shows
      // - If coinBlocked is absent/undefined (user not blocked): clear store → banner hides
      // This handles both new blocks AND block expiry.
      if (d?.coinBlocked) {
        useGamificationStore.getState().syncWithService({ coinBlocked: d.coinBlocked });
      } else if (useGamificationStore.getState().coinBlocked?.blocked) {
        // Block status was previously set but server no longer returns it — block expired
        useGamificationStore.getState().syncWithService({ coinBlocked: null });
      }

      // ── Bonus steps ─────────────────────────────────────────────────────────
      // Written unconditionally (not only when > 0) so that a bonus being revoked
      // clears the local copy instead of leaving it stuck on the old amount.
      if (typeof d?.bonusSteps === 'number') {
        useHealthDataStore.getState().setBonusSteps(Math.max(0, d.bonusSteps), today);
      }

      // Push the server's total to the notification and widget so every surface
      // agrees. `d.date` is the date the server actually wrote, which is the only
      // safe thing to compare against: without it these guards were comparing
      // against `undefined` and never ran, so the widget silently stopped
      // tracking the server total.
      //
      // healthDataStore.data is deliberately NOT written here — loadData owns it,
      // and having two writers made the displayed value oscillate.
      if (d?.totalSteps > 0 && d?.date === today) {
        import('../../../services/stepService').then(({ stepService }) => {
          stepService.forceRefreshSteps(d.totalSteps).catch(() => {});
        });
      }

      // Always invalidate weekly-steps after a sync so the chart reflects
      // the freshly written data immediately — no stale bar for today.
      queryClient.invalidateQueries({ queryKey: ['weekly-steps'] });

      // Always invalidate streaks — the server may have incremented the streak
      // counter even when no coins were awarded (e.g. goal met but coins already
      // claimed today). Keeping this stale would show the wrong streak count.
      queryClient.invalidateQueries({ queryKey: ['streaks'] });

      // Always invalidate challenges after a sync — the period key may have
      // changed (e.g. after midnight) and progress needs to reflect the new day.
      queryClient.invalidateQueries({ queryKey: ['challenges'] });

      // Always invalidate coin-data after a sync — even when no coins are
      // awarded — because claimable reward state may have changed (e.g. hydration
      // goal met makes hydration_daily claimable, or step validation changed state).
      queryClient.invalidateQueries({ queryKey: ['coin-data'] });
      queryClient.invalidateQueries({ queryKey: ['coin-transactions'] });

      // Refresh gamification if coins were awarded OR if cheat warning/block changed
      const awardedCoins = d?.goalCoinsAwarded || d?.newlyCompleted?.length > 0;
      if (awardedCoins || d?.coinBlocked || d?.cheatWarning) {
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      }

      if (d?.goalCoinsAwarded) {
        showStepGoalNotification(d.stepGoalCoins ?? 50);
      }

      if (d?.newlyCompleted?.length) {
        showChallengeNotifications(d.newlyCompleted);
      }
    },
  });

  return {
    syncHealth: mutation.mutate,
    isPending:  mutation.isPending,
  };
}

// Export channel setup so App.tsx can call it after permission is granted
export { setupNotifChannels };
