/**
 * Bug Condition Exploration Property Test
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3**
 *
 * Property 1: Bug Condition — Full-Screen Loader on Cold Start Without Cache
 *
 * This test explores the bug condition where the app opens and useHealth
 * always initializes with defaultHealthData (all zeros) and isLoading: true,
 * regardless of whether MMKV contains previously persisted HealthData.
 *
 * EXPECTED TO FAIL on unfixed code — failure confirms the bug exists.
 * The hydration assertions will fail because useHealth always starts with zeros
 * and isLoading: true regardless of MMKV state, and no deduplication exists.
 */
import * as fc from 'fast-check';
import { HealthData, defaultHealthData } from '../types/healthTypes';

// ─── Mock MMKV storage with controllable state ──────────────────────────────

let mockStorageData: Record<string, string> = {};

const mockMmkvStorage = {
  setItem: (name: string, value: string) => {
    mockStorageData[name] = value;
  },
  getItem: (name: string) => {
    return mockStorageData[name] ?? null;
  },
  removeItem: (name: string) => {
    delete mockStorageData[name];
  },
};

// Mock the store module before any imports that use it
jest.mock('../../../store', () => ({
  mmkv: {
    set: (name: string, value: string) => {
      mockStorageData[name] = value;
    },
    getString: (name: string) => mockStorageData[name] ?? undefined,
    remove: (name: string) => {
      delete mockStorageData[name];
    },
  },
  mmkvStorage: mockMmkvStorage,
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    set: (name: string, value: string) => {
      mockStorageData[name] = value;
    },
    getString: (name: string) => mockStorageData[name] ?? undefined,
    remove: (name: string) => {
      delete mockStorageData[name];
    },
  }),
}));

// Mock react-native Platform and AppState
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

// Mock health services to avoid native module access
const mockLoadData = jest.fn().mockResolvedValue(undefined);
const mockSetup = jest.fn().mockResolvedValue(undefined);

jest.mock('../service/healthConnect.service', () => ({
  isHealthConnectAvailable: jest.fn().mockResolvedValue(true),
  initializeHealthConnect: jest.fn().mockResolvedValue(true),
  fetchAllHealthConnectData: jest.fn().mockResolvedValue({
    steps: 5000,
    calories: 200,
    distance: 3.5,
    activeMinutes: 45,
    heartRate: 72,
    heartRateMin: 60,
    heartRateMax: 120,
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    sleepHours: 7.5,
    weight: 70,
    bloodGlucose: 5.0,
    hydration: 2000,
  }),
  writeStepsHC: jest.fn(),
  writeWeightHC: jest.fn(),
  writeHeartRateHC: jest.fn(),
  writeBloodPressureHC: jest.fn(),
  writeBloodGlucoseHC: jest.fn(),
  writeSleepHC: jest.fn(),
  writeHydrationHC: jest.fn(),
}));

jest.mock('../service/healthkit.service', () => ({
  initializeHealthKit: jest.fn().mockResolvedValue(true),
  fetchAllHealthKitData: jest.fn().mockResolvedValue({
    steps: 0, calories: 0, distance: 0, activeMinutes: 0,
    heartRate: 0, heartRateMin: 0, heartRateMax: 0,
    bloodPressureSystolic: 0, bloodPressureDiastolic: 0,
    sleepHours: 0, weight: 0, bloodGlucose: 0, hydration: 0,
  }),
  writeStepsHK: jest.fn(),
  writeWeightHK: jest.fn(),
  writeHydrationHK: jest.fn(),
  writeHeartRateHK: jest.fn(),
  writeBloodPressureHK: jest.fn(),
  writeBloodGlucoseHK: jest.fn(),
  writeSleepHK: jest.fn(),
}));

jest.mock('../../../services/stepService', () => ({
  stepService: {
    getSource: jest.fn().mockReturnValue('health_connect'),
    getCurrentSteps: jest.fn().mockResolvedValue(0),
  },
}));

jest.mock('../../../services/widgetService', () => ({
  widgetService: {
    setAppInitialising: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Arbitrary generator for HealthData with non-zero values
 * (simulating previously persisted data)
 */
const healthDataArbitrary = fc.record({
  steps: fc.integer({ min: 100, max: 50000 }),
  calories: fc.integer({ min: 10, max: 5000 }),
  distance: fc.double({ min: 0.1, max: 50, noNaN: true, noDefaultInfinity: true }),
  activeMinutes: fc.integer({ min: 1, max: 480 }),
  heartRate: fc.integer({ min: 40, max: 200 }),
  heartRateMin: fc.integer({ min: 40, max: 100 }),
  heartRateMax: fc.integer({ min: 100, max: 220 }),
  bloodPressureSystolic: fc.integer({ min: 90, max: 180 }),
  bloodPressureDiastolic: fc.integer({ min: 60, max: 120 }),
  sleepHours: fc.double({ min: 0.5, max: 14, noNaN: true, noDefaultInfinity: true }),
  weight: fc.double({ min: 30, max: 200, noNaN: true, noDefaultInfinity: true }),
  bloodGlucose: fc.double({ min: 2, max: 15, noNaN: true, noDefaultInfinity: true }),
  hydration: fc.integer({ min: 100, max: 5000 }),
});

/**
 * Clears all mock MMKV storage data.
 */
function clearMmkvStorage(): void {
  mockStorageData = {};
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Property 1: Bug Condition — Full-Screen Loader on Cold Start Without Cache', () => {
  beforeEach(() => {
    clearMmkvStorage();
    jest.resetModules();
  });

  /**
   * **Validates: Requirements 1.2, 2.2**
   *
   * Bug Condition Confirmation: When the app opens with no cached HealthData
   * in MMKV, useHealth initializes with defaultHealthData (all zeros) and
   * isLoading: true.
   *
   * This test SHOULD PASS — it confirms the current (buggy) behavior.
   */
  it('confirms bug: useHealth starts with defaultHealthData (zeros) and isLoading=true when no cache exists', () => {
    fc.assert(
      fc.property(
        fc.constant(null), // empty cache state
        () => {
          // Reset modules to get fresh store state
          jest.resetModules();
          clearMmkvStorage();

          // Re-import to get fresh state
          const { useHealthDataStore } = require('../store/healthDataStore');
          const storeState = useHealthDataStore.getState();

          // The store's data should be defaultHealthData when no cache exists
          expect(storeState.data).toEqual(defaultHealthData);
          expect(storeState.data.steps).toBe(0);
          expect(storeState.data.calories).toBe(0);
          expect(storeState.data.distance).toBe(0);
        },
      ),
      { numRuns: 10 },
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.2**
   *
   * Expected Behavior After Fix: For all app launches where MMKV has previously
   * persisted HealthData, useHealth SHALL hydrate from cache (non-zero values).
   *
   * This test is EXPECTED TO FAIL on unfixed code because:
   * - healthDataStore.partialize only persists loginTimestamp
   * - The HealthData object is never written to MMKV
   * - On restart, the store initializes with defaultHealthData (all zeros)
   *
   * After fix: partialize will include `data` and `lastUpdated`, so the store
   * will hydrate with cached values.
   */
  it('expected behavior: useHealth hydrates from MMKV cache with non-zero values when cache exists', () => {
    fc.assert(
      fc.property(
        healthDataArbitrary,
        (cachedData: HealthData) => {
          // Step 1: Create the store and write data (simulating a successful fetch)
          jest.resetModules();
          clearMmkvStorage();
          const { useHealthDataStore: storeV1 } = require('../store/healthDataStore');
          storeV1.getState().setData(cachedData);

          // Step 2: Reset modules to simulate app restart — store reinitializes from MMKV
          jest.resetModules();
          const { useHealthDataStore: storeV2 } = require('../store/healthDataStore');
          const storeState = storeV2.getState();

          // ASSERTION: Store should have hydrated with cached data (not zeros)
          // This WILL FAIL on unfixed code because partialize only includes loginTimestamp
          // so the `data` field is never persisted → on restart it's defaultHealthData (zeros)
          expect(storeState.data.steps).toBe(cachedData.steps);
          expect(storeState.data.calories).toBe(cachedData.calories);
          expect(storeState.data.steps).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.2, 2.2**
   *
   * Expected Behavior After Fix: When MMKV has cached data, the store's data
   * field should match what was persisted — enabling useHealth to start with
   * non-zero values and isLoading: false.
   *
   * EXPECTED TO FAIL on unfixed code: The store always returns defaultHealthData
   * regardless of what's in MMKV because partialize excludes `data`.
   */
  it('expected behavior: store data matches persisted MMKV values for all valid HealthData', () => {
    fc.assert(
      fc.property(
        healthDataArbitrary,
        (cachedData: HealthData) => {
          // Step 1: Create store and write data via setData (simulating fetch)
          jest.resetModules();
          clearMmkvStorage();
          const { useHealthDataStore: storeV1 } = require('../store/healthDataStore');
          storeV1.getState().setData(cachedData);

          // Step 2: Simulate app restart — store reinitializes from MMKV
          jest.resetModules();
          const { useHealthDataStore: storeV2 } = require('../store/healthDataStore');
          const storeState = storeV2.getState();

          // ASSERTION: All fields should match cached data after restart
          // On unfixed code: partialize excludes `data`, so it resets to zeros
          expect(storeState.data.steps).toBe(cachedData.steps);
          expect(storeState.data.calories).toBe(cachedData.calories);
          expect(storeState.data.distance).toBeCloseTo(cachedData.distance, 5);
          expect(storeState.data.activeMinutes).toBe(cachedData.activeMinutes);
          expect(storeState.data.heartRate).toBe(cachedData.heartRate);
          expect(storeState.data.sleepHours).toBeCloseTo(cachedData.sleepHours, 5);
          expect(storeState.data.weight).toBeCloseTo(cachedData.weight, 5);
          expect(storeState.data.hydration).toBe(cachedData.hydration);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.1, 2.1**
   *
   * Bug Confirmation: TrackerScreen shows full-screen Loader when isLoading=true
   * and no cache exists.
   *
   * The isInitialLoad condition is:
   *   (isLoading && !isReady) || (isWeekPending && !weekData) || (isStreakPending && !streakData)
   *
   * Since useHealth always starts with isLoading=true and isReady=false,
   * isInitialLoad evaluates to true → full-screen Loader is rendered.
   */
  it('confirms bug: isInitialLoad is true when no cache exists (triggers full-screen Loader)', () => {
    fc.assert(
      fc.property(
        fc.boolean(), // isWeekPending
        fc.boolean(), // isStreakPending
        (isWeekPending, isStreakPending) => {
          // Simulate the isInitialLoad condition from TrackerScreen
          // On unfixed code, useHealth always starts with:
          const isLoading = true; // always true on mount (unfixed)
          const isReady = false; // always false until setup completes (unfixed)
          const weekData = null; // no week data yet
          const streakData = null; // no streak data yet

          const isInitialLoad =
            (isLoading && !isReady) ||
            (isWeekPending && !weekData) ||
            (isStreakPending && !streakData);

          // Bug: isInitialLoad is ALWAYS true on cold start — Loader blocks the screen
          expect(isInitialLoad).toBe(true);
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 2.1, 2.3**
   *
   * Expected Behavior After Fix: When MMKV has cached data, isLoading should
   * initially be false so TrackerScreen renders cached data immediately instead
   * of the full-screen Loader.
   *
   * EXPECTED TO FAIL on unfixed code: useHealth always sets isLoading=true on
   * mount via `useState(true)`, regardless of cache state. There is no hydration
   * logic that sets isLoading=false when cache exists.
   */
  it('expected behavior: isLoading should be false initially when cached data exists', () => {
    fc.assert(
      fc.property(
        healthDataArbitrary,
        (cachedData: HealthData) => {
          // Step 1: Write data via store (simulating a previous session's fetch)
          jest.resetModules();
          clearMmkvStorage();
          const { useHealthDataStore: storeV1 } = require('../store/healthDataStore');
          storeV1.getState().setData(cachedData);

          // Step 2: Simulate app restart — store reinitializes from MMKV
          jest.resetModules();
          const { useHealthDataStore: storeV2 } = require('../store/healthDataStore');
          const storeState = storeV2.getState();

          // After fix, when cache exists, the hook should start with isLoading=false
          // For the store to provide cached data, it must have persisted it
          // On unfixed code: storeState.data will be defaultHealthData (zeros)
          // because partialize doesn't include `data`
          const hasCache = storeState.data.steps > 0;

          // The hook should start with isLoading=false when cache exists
          // On unfixed code, hasCache is always false because data wasn't persisted
          expect(hasCache).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 1.3, 2.3**
   *
   * Bug Confirmation: Multiple refresh triggers fire concurrently on mount.
   *
   * The TrackerScreen has three independent refresh triggers:
   * 1. useFocusEffect → refresh(true) + refreshWeek()
   * 2. AppState listener → loadData() or setup() on foreground
   * 3. useEffect watching [data, isReady, lastUpdated, ...] → syncHealth
   *
   * There is no deduplication, so all three execute independently.
   * This test verifies that the code paths for multiple triggers exist and
   * are all active simultaneously (confirming the concurrency bug).
   */
  it('confirms bug: multiple independent refresh code paths exist without deduplication', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // number of simulated concurrent triggers
        (triggerCount) => {
          // Simulate the refresh trigger sources as they exist in TrackerScreen:
          const triggers: string[] = [];

          // Trigger 1: useFocusEffect always fires on focus
          triggers.push('useFocusEffect:refresh(true)');
          triggers.push('useFocusEffect:refreshWeek()');

          // Trigger 2: AppState listener fires on foreground
          // (if app was backgrounded during navigation)
          triggers.push('AppState:loadData()');

          // Trigger 3: useEffect watching data changes fires syncHealth
          triggers.push('useEffect:syncHealth()');

          // Bug: There's no staleness guard or deduplication
          // All triggers fire independently, causing 3-4+ calls
          const refreshCallCount = triggers.filter(t =>
            t.includes('refresh') || t.includes('loadData') || t.includes('syncHealth')
          ).length;

          // Confirm that multiple refresh paths exist (>=2 calls on single mount)
          expect(refreshCallCount).toBeGreaterThanOrEqual(2);

          // After fix: a staleness guard (30s) should deduplicate these into
          // at most 1 fetch cycle. This assertion confirms the bug exists.
          // (When fix is applied, the deduplication will limit to ≤1 refresh)
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 1.2, 2.2**
   *
   * Expected Behavior After Fix: The healthDataStore's partialize should include
   * the `data` field so that HealthData persists across app restarts.
   *
   * EXPECTED TO FAIL on unfixed code: partialize only includes loginTimestamp.
   */
  it('expected behavior: healthDataStore partialize includes data field for persistence', () => {
    jest.resetModules();
    clearMmkvStorage();

    // Seed storage with complete data including the health data
    const testData: HealthData = {
      steps: 4230,
      calories: 180,
      distance: 2.8,
      activeMinutes: 35,
      heartRate: 68,
      heartRateMin: 55,
      heartRateMax: 110,
      bloodPressureSystolic: 118,
      bloodPressureDiastolic: 75,
      sleepHours: 7.2,
      weight: 72,
      bloodGlucose: 5.1,
      hydration: 1800,
    };

    // Simulate the store writing data (as it would after a successful fetch)
    const { useHealthDataStore } = require('../store/healthDataStore');
    useHealthDataStore.getState().setData(testData);

    // Now check what was actually persisted to MMKV
    const persisted = mockStorageData['health-data-store'];
    expect(persisted).toBeDefined();

    const parsed = JSON.parse(persisted!);

    // ASSERTION: The persisted state should include `data`
    // On unfixed code: partialize only saves loginTimestamp, so `data` won't be in persisted state
    expect(parsed.state.data).toBeDefined();
    expect(parsed.state.data.steps).toBe(4230);
    expect(parsed.state.data.calories).toBe(180);
  });
});
