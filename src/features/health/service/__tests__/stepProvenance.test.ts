/**
 * The provenance block attached to a step sync.
 *
 * Its job is to make the number in the payload explainable afterwards, so the
 * one thing it must never do is describe a source other than the one the figure
 * actually came from. Attributing a native-sensor total to Health Connect would
 * be worse than sending nothing: it would send an investigation looking at the
 * per-app breakdown of a source that produced none of the steps.
 */

import { buildStepSource } from '../stepProvenance';
import type { StepsReadResult } from '../healthConnect.service';
import type { StepResolution } from '../stepEngine';

const resolution = (winner: StepResolution['winner']): StepResolution => ({
  deviceSteps: 17240,
  displaySteps: 17240,
  bonusSteps: 0,
  winner,
  accepted: [],
  rejected: [],
  explanation: 'test',
});

const read = (over: Partial<StepsReadResult> = {}): StepsReadResult => ({
  steps: 17240,
  available: true,
  origins: [
    { packageName: 'com.sec.android.app.shealth', steps: 17240 },
    { packageName: 'com.google.android.apps.fitness', steps: 16900 },
  ],
  largestOrigin: 17240,
  originSum: 34140,
  method: 'coverage-dedup',
  contributions: [
    {
      packageName: 'com.google.android.apps.fitness',
      steps: 16900,
      disjointFraction: 0.03,
      contributed: 0,
    },
  ],
  primaryOrigin: 'com.sec.android.app.shealth',
  hourly: Array.from({ length: 24 }, (_, h) => (h >= 6 && h <= 21 ? 1077 : 0)),
  recordedFrom: '2026-08-28T00:42:00.000Z',
  recordedTo: '2026-08-28T15:31:00.000Z',
  recordCount: 61,
  ...over,
});

describe('buildStepSource', () => {
  it('credits the primary origin with everything it reported', () => {
    // The primary has no contribution row of its own — it IS the dedup baseline.
    // Reading `contributed` from the contributions list alone would record the
    // origin that supplied the entire day as having contributed none of it,
    // which inverts the answer to "where did these steps come from".
    const block = buildStepSource({
      read: read(),
      resolution: resolution('health_connect'),
      lastSyncedAt: null,
    })!;

    const primary = block.origins.find(
      o => o.packageName === 'com.sec.android.app.shealth',
    )!;
    expect(primary.contributed).toBe(17240);
    expect(primary.disjointFraction).toBe(1);
  });

  it('reports a mirrored origin as seen but not counted', () => {
    // The direct answer to "Google Fit says 16,900, why does the app say
    // 17,240?" — the steps were seen and deliberately not double-counted.
    const block = buildStepSource({
      read: read(),
      resolution: resolution('health_connect'),
      lastSyncedAt: null,
    })!;

    const fit = block.origins.find(
      o => o.packageName === 'com.google.android.apps.fitness',
    )!;
    expect(fit.steps).toBe(16900);
    expect(fit.contributed).toBe(0);
  });

  it('does not attribute a native-sensor figure to Health Connect', () => {
    // A Health Connect read can exist and still lose to the sensor. Describing
    // the losing read would explain a number that was never sent.
    const block = buildStepSource({
      read: read(),
      resolution: resolution('native_sensor'),
      lastSyncedAt: null,
    })!;

    expect(block.reader).toBe('native_sensor');
    expect(block.origins).toEqual([]);
    expect(block.hourly).toBeUndefined();
  });

  it('names the server when this device is only passing a value back', () => {
    const block = buildStepSource({
      read: read(),
      resolution: resolution('server'),
      lastSyncedAt: null,
    })!;
    expect(block.reader).toBe('server');
  });

  it('reports the silence before a backlog', () => {
    const threeDays = Date.now() - 3 * 24 * 60 * 60 * 1000;
    const block = buildStepSource({
      read: read(),
      resolution: resolution('health_connect'),
      lastSyncedAt: threeDays,
    })!;

    expect(block.offlineMinutes).toBeGreaterThanOrEqual(4310);
    expect(block.offlineMinutes).toBeLessThanOrEqual(4330);
  });

  it('omits the offline gap when the device has never synced', () => {
    // Sending 0 would claim the device had just synced, turning the field that
    // explains a first-sync backlog into a reason to distrust it.
    const block = buildStepSource({
      read: read(),
      resolution: resolution('health_connect'),
      lastSyncedAt: null,
    })!;
    expect(block.offlineMinutes).toBeUndefined();
  });

  it('names HealthKit as the health store rather than as no source at all', () => {
    // iOS: the winner is the platform health store, but it exposes no per-origin
    // read to describe. Falling through to 'unknown' would label every iOS sync
    // as coming from a build that cannot report its source — wrong in the way
    // that costs the most time, since it points at the client version instead of
    // at HealthKit.
    const block = buildStepSource({
      read: null,
      resolution: resolution('health_connect'),
      lastSyncedAt: null,
    })!;

    expect(block.reader).toBe('health_connect');
    expect(block.method).toBe('platform-store');
    expect(block.origins).toEqual([]);
  });

  it('still says something when no source resolved', () => {
    // "Steps synced and nothing claims them" is a finding. An absent block is
    // indistinguishable from an old build that cannot send one.
    const block = buildStepSource({
      read: null,
      resolution: resolution('none'),
      lastSyncedAt: null,
    })!;
    expect(block.reader).toBe('unknown');
  });

  it('sends nothing when the pipeline has not resolved at all', () => {
    expect(
      buildStepSource({ read: null, resolution: null, lastSyncedAt: null }),
    ).toBeUndefined();
  });
});
