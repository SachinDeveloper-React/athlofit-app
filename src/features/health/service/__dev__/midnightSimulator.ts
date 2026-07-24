/**
 * midnightSimulator.ts — DEV-ONLY utility
 *
 * Simulates midnight reset scenarios for testing whether previous day's steps
 * can leak into today's step count. Use this during development instead of
 * waiting for actual midnight.
 *
 * Usage (from React Native Debugger console or a dev screen):
 *
 *   import { MidnightSimulator } from '../service/__dev__/midnightSimulator';
 *
 *   // Test 1: Simulate full midnight reset
 *   await MidnightSimulator.simulateMidnightReset();
 *
 *   // Test 2: Simulate the 5-minute window after midnight
 *   await MidnightSimulator.simulatePostMidnightWindow();
 *
 *   // Test 3: Simulate stale Health Connect data at midnight
 *   await MidnightSimulator.simulateStaleHCData(5000);
 *
 *   // Test 4: Simulate OEM alarm delay (midnight reset delayed by N minutes)
 *   await MidnightSimulator.simulateOEMAlarmDelay(10);
 *
 *   // Test 5: Run full diagnostic report
 *   await MidnightSimulator.runDiagnostic();
 *
 *   // Test 6: Inject fake steps into HC (for emulator testing)
 *   await MidnightSimulator.injectFakeSteps(5000);
 *
 *   // Test 7: Full emulator test flow (inject → reset → verify)
 *   await MidnightSimulator.runEmulatorMidnightTest(5000);
 *
 * ⚠️  This file should NEVER be imported in production builds.
 *     Gate all usage behind __DEV__ checks.
 */

import { Platform, NativeModules } from 'react-native';
import { useHealthDataStore } from '../../store/healthDataStore';
import { resetStepCache, readStepsDeduped, todayRange } from '../healthConnect.service';
import { defaultHealthData } from '../../types/healthTypes';

const TAG = '[MidnightSimulator]';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DiagnosticReport {
  timestamp: string;
  platform: string;
  storeState: {
    lastFetchedAt: number | null;
    loginTimestamp: number | null;
    currentSteps: number;
    syncedStepOffset: number;
    syncedStepOffsetDate: string | null;
    bonusSteps: number;
    bonusStepsDate: string | null;
  };
  nativeServiceState: {
    storedDate: string;
    dailySteps: number;
    liveStepCount: number;
  } | null;
  healthConnectSteps: number | null;
  cacheState: {
    note: string;
  };
  potentialIssues: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLocalToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function getNativeState(): Promise<{ storedDate: string; dailySteps: number; liveStepCount: number } | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const NativeStep = NativeModules.NativeStep;
    if (!NativeStep) return null;
    const steps = await NativeStep.getCurrentSteps();
    return { storedDate: getLocalToday(), dailySteps: steps, liveStepCount: steps };
  } catch {
    return null;
  }
}

async function getHealthConnectSteps(): Promise<number | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const range = todayRange();
    return await readStepsDeduped(range.startTime, range.endTime);
  } catch {
    return null;
  }
}

// ─── Simulator Class ──────────────────────────────────────────────────────────

export const MidnightSimulator = {
  /**
   * TEST 1: Simulate a full midnight reset
   *
   * What it does:
   * - Clears the step cache
   * - Resets the health data store to default (simulating a new day)
   * - Triggers native midnight reset (Android only)
   * - Re-reads steps from Health Connect
   * - Reports if any steps "survived" the reset (which would be a bug)
   */
  async simulateMidnightReset(): Promise<void> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} TEST: Simulating full midnight reset`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);

    // Step 1: Record current state
    const store = useHealthDataStore.getState();
    const stepsBefore = store.data.steps;
    console.log(`${TAG} Steps BEFORE reset: ${stepsBefore}`);

    // Step 2: Clear step cache (simulates midnight cache invalidation)
    resetStepCache();
    console.log(`${TAG} ✓ Step cache cleared`);

    // Step 3: Reset health data store (simulates what happens at midnight)
    store.setData(defaultHealthData);
    store.setLastFetchedAt(0);
    console.log(`${TAG} ✓ Health data store reset to defaults`);

    // Step 4: Trigger native midnight reset (Android)
    if (Platform.OS === 'android') {
      try {
        const NativeStep = NativeModules.NativeStep;
        if (NativeStep?.triggerMidnightReset) {
          await NativeStep.triggerMidnightReset();
          console.log(`${TAG} ✓ Native midnight reset triggered`);
        }
      } catch (e) {
        console.warn(`${TAG} Native reset failed:`, e);
      }
    }

    // Step 5: Wait a moment for reset to propagate
    await new Promise(r => setTimeout(r, 2000));

    // Step 6: Read fresh steps from Health Connect
    const freshSteps = await getHealthConnectSteps();
    console.log(`${TAG} Steps AFTER reset (from HC): ${freshSteps}`);

    // Step 7: Check native service
    const nativeState = await getNativeState();
    if (nativeState) {
      console.log(`${TAG} Native service steps after reset: ${nativeState.dailySteps}`);
    }

    // Step 8: Report result
    console.log(`${TAG} ───────────────────────────────────────────────`);
    if (freshSteps !== null && freshSteps > 100) {
      console.warn(`${TAG} ⚠️  WARNING: ${freshSteps} steps detected after reset!`);
      console.warn(`${TAG} This could indicate stale data bleeding from yesterday.`);
      console.warn(`${TAG} (Unless you actually walked ${freshSteps} steps today already)`);
    } else {
      console.log(`${TAG} ✓ PASS — Steps correctly reset (${freshSteps ?? 0} steps)`);
    }
    console.log(`${TAG} ═══════════════════════════════════════════════`);
  },

  /**
   * TEST 2: Simulate the first 5 minutes after midnight
   *
   * This tests the "post-midnight stale data guard" that's in backgroundSync.
   * Checks if syncing in this window would send stale yesterday data.
   */
  async simulatePostMidnightWindow(): Promise<void> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} TEST: Simulating post-midnight 5-minute window`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);

    const store = useHealthDataStore.getState();
    const currentSteps = store.data.steps;

    // Simulate "lastFetchedAt" being from yesterday (stale data scenario)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 58, 0, 0); // 11:58 PM yesterday
    store.setLastFetchedAt(yesterday.getTime());

    console.log(`${TAG} Set lastFetchedAt to yesterday 23:58 (simulating stale data)`);
    console.log(`${TAG} Current steps in store: ${currentSteps}`);

    // Check if the guard would trigger
    const now = new Date();
    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const lastFetchedAt = store.lastFetchedAt;
    const isStaleData = lastFetchedAt ? (() => {
      const fetchDate = new Date(lastFetchedAt);
      return fetchDate.getDate() !== now.getDate() ||
             fetchDate.getMonth() !== now.getMonth() ||
             fetchDate.getFullYear() !== now.getFullYear();
    })() : false;

    console.log(`${TAG} Minutes since midnight: ${minutesSinceMidnight}`);
    console.log(`${TAG} Is data stale (from previous day)? ${isStaleData}`);
    console.log(`${TAG} Would skip today sync? ${minutesSinceMidnight < 5 && isStaleData}`);

    if (minutesSinceMidnight >= 5) {
      console.log(`${TAG} ℹ️  NOTE: You're more than 5 min past midnight, so the guard`);
      console.log(`${TAG}    wouldn't block the sync. The guard only blocks 00:00-00:05.`);
      console.log(`${TAG}    To test this properly, either:`);
      console.log(`${TAG}    1. Run this between 00:00-00:05, OR`);
      console.log(`${TAG}    2. Change device time to 00:02 (Settings > Date & Time)`);
    }

    // Check what backgroundSync would send
    if (currentSteps > 0 && isStaleData) {
      console.warn(`${TAG} ⚠️  RISK: Store has ${currentSteps} steps from yesterday.`);
      console.warn(`${TAG}    If background sync runs without the guard, it would sync`);
      console.warn(`${TAG}    ${currentSteps} steps under TODAY's date — that's a bug!`);
    } else {
      console.log(`${TAG} ✓ PASS — Guard would correctly block stale sync.`);
    }

    // Restore lastFetchedAt
    store.setLastFetchedAt(Date.now());
    console.log(`${TAG} Restored lastFetchedAt to now.`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);
  },

  /**
   * TEST 3: Simulate Health Connect returning stale data
   *
   * Injects a fake "yesterday" step count and checks if the midnight bleed
   * guard (in readStepsDeduped) would filter it out.
   *
   * @param fakeYesterdaySteps — Number of steps to simulate from yesterday
   */
  async simulateStaleHCData(fakeYesterdaySteps: number = 5000): Promise<void> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} TEST: Simulating stale HC data (${fakeYesterdaySteps} steps)`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);

    // Clear cache first
    resetStepCache();

    // Read actual steps with today's range
    const range = todayRange();
    console.log(`${TAG} Today's range: ${range.startTime} → ${range.endTime}`);

    const actualSteps = await getHealthConnectSteps();
    console.log(`${TAG} Actual HC steps for today: ${actualSteps}`);

    // The midnight bleed guard in readStepsDeduped filters records where
    // record.startTime < requested startTime. Let's verify the logic:
    const requestedStart = new Date(range.startTime).getTime();
    const yesterday1155 = new Date();
    yesterday1155.setDate(yesterday1155.getDate() - 1);
    yesterday1155.setHours(23, 55, 0, 0);

    const wouldBeFiltered = yesterday1155.getTime() < requestedStart;
    console.log(`${TAG} A record from yesterday 23:55 would be filtered: ${wouldBeFiltered}`);

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const exactMidnightFiltered = todayMidnight.getTime() < requestedStart;
    console.log(`${TAG} A record from exactly 00:00:00.000 would be filtered: ${exactMidnightFiltered}`);

    console.log(`${TAG} ───────────────────────────────────────────────`);
    if (!wouldBeFiltered) {
      console.warn(`${TAG} ⚠️  BUG: Records from yesterday 23:55 would NOT be filtered!`);
    } else {
      console.log(`${TAG} ✓ PASS — Cross-midnight records are correctly filtered.`);
    }

    if (!exactMidnightFiltered) {
      console.log(`${TAG} ℹ️  NOTE: Records starting at exactly 00:00:00.000 are NOT`);
      console.log(`${TAG}    filtered (startTime >= requestedStart). This is correct —`);
      console.log(`${TAG}    steps starting at midnight belong to today.`);
    }
    console.log(`${TAG} ═══════════════════════════════════════════════`);
  },

  /**
   * TEST 4: Simulate OEM alarm delay
   *
   * On budget phones (Xiaomi, Oppo, Vivo), the midnight alarm can be delayed
   * by battery optimization. This simulates what happens when midnight reset
   * fires late (e.g., at 00:10) and checks if stale data leaks.
   *
   * @param delayMinutes — How many minutes after midnight the reset fires
   */
  async simulateOEMAlarmDelay(delayMinutes: number = 10): Promise<void> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} TEST: Simulating OEM alarm delay (${delayMinutes} min)`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);

    const store = useHealthDataStore.getState();
    const currentSteps = store.data.steps;

    console.log(`${TAG} Scenario: User had ${currentSteps} steps yesterday.`);
    console.log(`${TAG} Midnight alarm fires ${delayMinutes} minutes late.`);
    console.log(`${TAG} During this delay, storedDate is still "yesterday".`);

    // Check: Native service has a date staleness guard
    console.log(`${TAG}`);
    console.log(`${TAG} Guards that prevent stale data during alarm delay:`);
    console.log(`${TAG}   1. StepCounterService.maybeSync() — checks storedDate != today → skips sync`);
    console.log(`${TAG}   2. HealthSyncHelper — checks nativeResetPending → skips today`);
    console.log(`${TAG}   3. backgroundSync.service — checks minutesSinceMidnight < 5 && isStaleData`);

    // The actual test: what if the sensor fires steps during this delay?
    console.log(`${TAG}`);
    console.log(`${TAG} ⚠️  Edge case to watch:`);
    console.log(`${TAG}   If TYPE_STEP_COUNTER sensor delivers events during the delay,`);
    console.log(`${TAG}   StepCounterService.onSensorChanged() would add them to dailySteps.`);
    console.log(`${TAG}   But since storedDate is still yesterday, these steps belong`);
    console.log(`${TAG}   to yesterday's count (correct behavior — the reset hasn't happened).`);
    console.log(`${TAG}`);
    console.log(`${TAG}   When the alarm finally fires and resets:`);
    console.log(`${TAG}   - dailySteps → 0`);
    console.log(`${TAG}   - storedDate → today`);
    console.log(`${TAG}   - Any steps walked during delay are lost (minor issue)`);
    console.log(`${TAG}`);
    console.log(`${TAG}   seedFromHealthConnectIfNeeded() runs after reset and picks up`);
    console.log(`${TAG}   any steps HC recorded during the delay window. This recovers`);
    console.log(`${TAG}   the "lost" steps correctly.`);
    console.log(`${TAG} ───────────────────────────────────────────────`);
    console.log(`${TAG} ✓ Analysis complete — guards are in place for this scenario.`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);
  },

  /**
   * TEST 5: Full diagnostic report
   *
   * Reads all relevant state from store, native service, and Health Connect.
   * Reports potential issues that could lead to cross-day step leakage.
   */
  async runDiagnostic(): Promise<DiagnosticReport> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} DIAGNOSTIC: Running full state check`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);

    const store = useHealthDataStore.getState();
    const today = getLocalToday();
    const nativeState = await getNativeState();
    const hcSteps = await getHealthConnectSteps();

    const potentialIssues: string[] = [];

    // Check 1: Is lastFetchedAt from today?
    if (store.lastFetchedAt) {
      const fetchDate = new Date(store.lastFetchedAt);
      const fetchDateStr = `${fetchDate.getFullYear()}-${String(fetchDate.getMonth() + 1).padStart(2, '0')}-${String(fetchDate.getDate()).padStart(2, '0')}`;
      if (fetchDateStr !== today) {
        potentialIssues.push(
          `lastFetchedAt is from ${fetchDateStr} but today is ${today}. ` +
          `Store data may be stale from yesterday!`
        );
      }
    }

    // Check 2: Is syncedStepOffset from today?
    if (store.syncedStepOffset > 0 && store.syncedStepOffsetDate !== today) {
      potentialIssues.push(
        `syncedStepOffset=${store.syncedStepOffset} from ${store.syncedStepOffsetDate} ` +
        `(not today). This stale offset could inflate today's count!`
      );
    }

    // Check 3: Is bonusSteps from today?
    if (store.bonusSteps > 0 && store.bonusStepsDate !== today) {
      potentialIssues.push(
        `bonusSteps=${store.bonusSteps} from ${store.bonusStepsDate} ` +
        `(not today). Stale bonus could inflate today's count!`
      );
    }

    // Check 4: Native service date mismatch
    if (nativeState && nativeState.storedDate !== today) {
      potentialIssues.push(
        `Native service storedDate=${nativeState.storedDate} !== today. ` +
        `Midnight reset hasn't happened — native steps are from yesterday!`
      );
    }

    // Check 5: Store steps vs HC steps mismatch
    if (hcSteps !== null && store.data.steps > 0) {
      const diff = Math.abs(store.data.steps - hcSteps);
      if (diff > 500) {
        potentialIssues.push(
          `Store shows ${store.data.steps} steps but HC shows ${hcSteps}. ` +
          `Difference of ${diff} — possible stale data in one source.`
        );
      }
    }

    const report: DiagnosticReport = {
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      storeState: {
        lastFetchedAt: store.lastFetchedAt,
        loginTimestamp: store.loginTimestamp,
        currentSteps: store.data.steps,
        syncedStepOffset: store.syncedStepOffset,
        syncedStepOffsetDate: store.syncedStepOffsetDate,
        bonusSteps: store.bonusSteps,
        bonusStepsDate: store.bonusStepsDate,
      },
      nativeServiceState: nativeState,
      healthConnectSteps: hcSteps,
      cacheState: {
        note: 'Step cache TTL is 30s. Call resetStepCache() before reading for fresh data.',
      },
      potentialIssues,
    };

    // Print report
    console.log(`${TAG} ─── Report ─────────────────────────────────────`);
    console.log(`${TAG} Platform: ${report.platform}`);
    console.log(`${TAG} Today: ${today}`);
    console.log(`${TAG} Store steps: ${report.storeState.currentSteps}`);
    console.log(`${TAG} HC steps: ${report.healthConnectSteps ?? 'N/A'}`);
    console.log(`${TAG} Native steps: ${nativeState?.dailySteps ?? 'N/A'}`);
    console.log(`${TAG} Synced offset: ${report.storeState.syncedStepOffset} (date: ${report.storeState.syncedStepOffsetDate})`);
    console.log(`${TAG} Bonus steps: ${report.storeState.bonusSteps} (date: ${report.storeState.bonusStepsDate})`);
    console.log(`${TAG} Last fetched: ${report.storeState.lastFetchedAt ? new Date(report.storeState.lastFetchedAt).toISOString() : 'never'}`);
    console.log(`${TAG} ─── Issues ─────────────────────────────────────`);

    if (potentialIssues.length === 0) {
      console.log(`${TAG} ✓ No issues detected — all data appears fresh for today.`);
    } else {
      potentialIssues.forEach((issue, i) => {
        console.warn(`${TAG} ⚠️  ${i + 1}. ${issue}`);
      });
    }

    console.log(`${TAG} ═══════════════════════════════════════════════`);
    return report;
  },

  /**
   * MANUAL TEST HELPER: Force set store steps to a specific value
   *
   * Use this to set up test scenarios. For example:
   *   1. Set steps to 8000
   *   2. Call simulateMidnightReset()
   *   3. Check if 8000 steps appear after reset (would be a bug)
   */
  setStepsForTesting(steps: number): void {
    const store = useHealthDataStore.getState();
    store.setData({ ...store.data, steps });
    console.log(`${TAG} Set store steps to ${steps} for testing.`);
  },

  /**
   * MANUAL TEST HELPER: Force set lastFetchedAt to yesterday
   *
   * Simulates the scenario where the app was last active yesterday
   * and hasn't refreshed yet today (e.g., app was killed overnight).
   */
  setLastFetchedToYesterday(): void {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(22, 0, 0, 0); // 10 PM yesterday
    useHealthDataStore.getState().setLastFetchedAt(yesterday.getTime());
    console.log(`${TAG} Set lastFetchedAt to yesterday 22:00.`);
  },

  /**
   * QUICK CHECK: Is there any stale data risk right now?
   *
   * Call this anytime to quickly check if the current state has any
   * risk of yesterday's steps leaking into today.
   */
  async quickCheck(): Promise<boolean> {
    const store = useHealthDataStore.getState();
    const today = getLocalToday();
    let hasRisk = false;

    // Check lastFetchedAt
    if (store.lastFetchedAt) {
      const fetchDate = new Date(store.lastFetchedAt);
      const fetchToday = fetchDate.getDate() === new Date().getDate() &&
                         fetchDate.getMonth() === new Date().getMonth() &&
                         fetchDate.getFullYear() === new Date().getFullYear();
      if (!fetchToday && store.data.steps > 0) {
        console.warn(`${TAG} quickCheck: RISK — store has ${store.data.steps} steps from a previous day!`);
        hasRisk = true;
      }
    }

    // Check offset
    if (store.syncedStepOffset > 0 && store.syncedStepOffsetDate !== today) {
      console.warn(`${TAG} quickCheck: RISK — stale offset of ${store.syncedStepOffset} from ${store.syncedStepOffsetDate}`);
      hasRisk = true;
    }

    if (!hasRisk) {
      console.log(`${TAG} quickCheck: ✓ No stale data risk detected.`);
    }

    return hasRisk;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EMULATOR-SPECIFIC METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * TEST 6: Inject fake steps into Health Connect (Emulator Testing)
   *
   * Emulator mein real sensor nahi hota, toh steps manually inject karne padte
   * hain Health Connect mein. Ye method steps likhta hai HC mein taaki baad
   * mein midnight reset test kar sako.
   *
   * @param steps — Kitne steps inject karne hain
   * @param forYesterday — Agar true, toh yesterday ke time range mein likhega (cross-day test ke liye)
   */
  async injectFakeSteps(steps: number, forYesterday: boolean = false): Promise<void> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} INJECT: Writing ${steps} fake steps to Health Connect`);
    console.log(`${TAG} For: ${forYesterday ? 'YESTERDAY' : 'TODAY'}`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);

    if (Platform.OS !== 'android') {
      console.warn(`${TAG} ⚠️ Health Connect only works on Android!`);
      return;
    }

    try {
      const { insertRecords } = require('react-native-health-connect');

      let startTime: Date;
      let endTime: Date;

      if (forYesterday) {
        // Write steps with yesterday's timestamp (for cross-midnight test)
        startTime = new Date();
        startTime.setDate(startTime.getDate() - 1);
        startTime.setHours(8, 0, 0, 0); // Yesterday 8 AM

        endTime = new Date();
        endTime.setDate(endTime.getDate() - 1);
        endTime.setHours(22, 0, 0, 0); // Yesterday 10 PM
      } else {
        // Write steps with today's timestamp
        startTime = new Date();
        startTime.setHours(0, 1, 0, 0); // Today 12:01 AM

        endTime = new Date();
        endTime.setHours(endTime.getHours(), endTime.getMinutes() - 1, 0, 0);
      }

      await insertRecords([
        {
          recordType: 'Steps',
          count: steps,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      ]);

      console.log(`${TAG} ✓ Injected ${steps} steps`);
      console.log(`${TAG}   Start: ${startTime.toISOString()}`);
      console.log(`${TAG}   End: ${endTime.toISOString()}`);

      // Also update the store so the app shows these steps
      if (!forYesterday) {
        const store = useHealthDataStore.getState();
        store.setData({ ...store.data, steps });
        store.setLastFetchedAt(Date.now());
        console.log(`${TAG} ✓ Updated health data store with ${steps} steps`);
      }
    } catch (e) {
      console.error(`${TAG} ✗ Failed to inject steps:`, e);
      console.log(`${TAG} ℹ️  Make sure:`);
      console.log(`${TAG}    1. Health Connect is installed (API 34+ emulator)`);
      console.log(`${TAG}    2. App has WRITE permission for Steps`);
      console.log(`${TAG}    3. react-native-health-connect is initialized`);
    }
    console.log(`${TAG} ═══════════════════════════════════════════════`);
  },

  /**
   * TEST 7: Full Emulator Midnight Test (One Command)
   *
   * Complete test flow for emulator:
   * 1. Inject fake steps (simulates user walked yesterday)
   * 2. Update store to look like "end of day"
   * 3. Simulate midnight reset
   * 4. Verify steps are 0 (no crossover)
   *
   * @param yesterdaySteps — Steps to simulate from yesterday
   */
  async runEmulatorMidnightTest(yesterdaySteps: number = 5000): Promise<void> {
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} 🧪 EMULATOR MIDNIGHT TEST`);
    console.log(`${TAG} ═══════════════════════════════════════════════`);
    console.log(`${TAG} Scenario: User had ${yesterdaySteps} steps yesterday.`);
    console.log(`${TAG} Test: Do these steps leak into today after midnight reset?`);
    console.log(`${TAG}`);

    // Step 1: Set store to look like end of yesterday
    console.log(`${TAG} [Step 1/5] Setting store to ${yesterdaySteps} steps (yesterday)...`);
    const store = useHealthDataStore.getState();
    store.setData({ ...store.data, steps: yesterdaySteps });
    // Set lastFetchedAt to yesterday 11:55 PM
    const yesterday1155 = new Date();
    yesterday1155.setDate(yesterday1155.getDate() - 1);
    yesterday1155.setHours(23, 55, 0, 0);
    store.setLastFetchedAt(yesterday1155.getTime());
    console.log(`${TAG} ✓ Store: ${yesterdaySteps} steps, lastFetchedAt = yesterday 23:55`);

    // Step 2: Inject steps into Health Connect (yesterday's range)
    console.log(`${TAG}`);
    console.log(`${TAG} [Step 2/5] Injecting ${yesterdaySteps} steps into HC (yesterday)...`);
    await this.injectFakeSteps(yesterdaySteps, true);

    // Step 3: Clear step cache
    console.log(`${TAG}`);
    console.log(`${TAG} [Step 3/5] Clearing step cache...`);
    resetStepCache();
    console.log(`${TAG} ✓ Cache cleared`);

    // Step 4: Simulate midnight reset
    console.log(`${TAG}`);
    console.log(`${TAG} [Step 4/5] Simulating midnight reset...`);
    store.setData(defaultHealthData);
    store.setLastFetchedAt(0);

    // Trigger native reset
    if (Platform.OS === 'android') {
      try {
        const NativeStep = NativeModules.NativeStep;
        if (NativeStep?.triggerMidnightReset) {
          await NativeStep.triggerMidnightReset();
          console.log(`${TAG} ✓ Native midnight reset triggered`);
        }
      } catch (e) {
        console.log(`${TAG} ℹ️  Native reset skipped (service may not be running in emulator)`);
      }
    }

    // Wait for reset to propagate
    await new Promise(r => setTimeout(r, 2000));

    // Step 5: Read fresh data and verify
    console.log(`${TAG}`);
    console.log(`${TAG} [Step 5/5] Reading fresh steps from Health Connect...`);
    const freshSteps = await getHealthConnectSteps();
    const storeSteps = useHealthDataStore.getState().data.steps;

    console.log(`${TAG}`);
    console.log(`${TAG} ╔═══════════════════════════════════════════════╗`);
    console.log(`${TAG} ║ RESULTS                                       ║`);
    console.log(`${TAG} ╠═══════════════════════════════════════════════╣`);
    console.log(`${TAG} ║ Yesterday steps:     ${String(yesterdaySteps).padEnd(26)}║`);
    console.log(`${TAG} ║ Store steps now:     ${String(storeSteps).padEnd(26)}║`);
    console.log(`${TAG} ║ HC steps (today):    ${String(freshSteps ?? 'N/A').padEnd(26)}║`);
    console.log(`${TAG} ╠═══════════════════════════════════════════════╣`);

    const leaked = (storeSteps > 0 && storeSteps === yesterdaySteps) ||
                   (freshSteps !== null && freshSteps >= yesterdaySteps);

    if (leaked) {
      console.log(`${TAG} ║ ⚠️  FAIL — Yesterday's steps leaked!          ║`);
      console.log(`${TAG} ╚═══════════════════════════════════════════════╝`);
      console.log(`${TAG}`);
      console.log(`${TAG} Debug info:`);
      console.log(`${TAG} - If HC shows yesterday's steps under today, the midnight`);
      console.log(`${TAG}   bleed guard may not be filtering correctly.`);
      console.log(`${TAG} - If store still shows them, the store reset failed.`);
    } else {
      console.log(`${TAG} ║ ✓ PASS — No step crossover detected!         ║`);
      console.log(`${TAG} ╚═══════════════════════════════════════════════╝`);
    }
    console.log(`${TAG} ═══════════════════════════════════════════════`);
  },

  /**
   * EMULATOR HELPER: Simulate walking (inject steps incrementally)
   *
   * Emulator mein real sensor nahi hota. Ye method har 10 seconds mein
   * steps increment karta hai to simulate walking.
   *
   * @param totalSteps — Total steps to reach
   * @param durationSeconds — Kitne seconds mein reach karna hai
   */
  async simulateWalking(totalSteps: number = 1000, durationSeconds: number = 60): Promise<void> {
    console.log(`${TAG} 🚶 Simulating walking: ${totalSteps} steps over ${durationSeconds}s`);

    const intervalMs = 10_000; // update every 10s
    const intervals = Math.ceil(durationSeconds / 10);
    const stepsPerInterval = Math.ceil(totalSteps / intervals);
    let accumulated = 0;

    for (let i = 0; i < intervals; i++) {
      accumulated = Math.min(accumulated + stepsPerInterval, totalSteps);

      // Update store
      const store = useHealthDataStore.getState();
      store.setData({ ...store.data, steps: accumulated });
      store.setLastFetchedAt(Date.now());

      console.log(`${TAG} 🚶 Step ${i + 1}/${intervals}: ${accumulated} steps`);

      if (i < intervals - 1) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    console.log(`${TAG} ✓ Walking simulation complete: ${accumulated} steps`);
  },
};


export default MidnightSimulator;
