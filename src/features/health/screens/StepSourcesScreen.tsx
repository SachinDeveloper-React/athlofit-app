// ─── StepSourcesScreen.tsx ────────────────────────────────────────────────────
//
// Diagnostic screen for the daily step count.
//
// ## What changed and why it matters
//
// This screen used to compute every row itself: it read Health Connect with its
// own "largest single origin" rule over midnight → now, read the native sensor,
// pulled the baseline and bonus out of the store, and printed the persisted total
// as "FINAL DISPLAYED STEPS". None of those rows were inputs to that total — the
// pipeline used a different Health Connect algorithm over a different time window
// and then applied a monotonic floor on top. So the screen could legitimately show
// "1,720 / 571 / 0 / 0 / 0" above a final value of 7,097, and no amount of staring
// at it would explain the number, because the rows and the total were unrelated
// computations.
//
// Now there is exactly one implementation of the decision — `resolveSteps` in
// stepEngine.ts — and this screen renders its output:
//
//   * "Pipeline decision" is the real resolution the app is displaying, published
//     to stepDebugStore by useHealth on every refresh. Not a re-derivation.
//   * "Live re-resolve" runs the same functions the pipeline runs, on demand, so
//     you can see what the sources say right now.
//   * Rejected sources are listed with the reason they were rejected. When a
//     number looks wrong, this is the section that explains it.
//
// If the pipeline decision and the live re-resolve disagree, that is now a real
// signal (the sources changed between the two reads) rather than an artefact of
// two different algorithms.

import React, { useEffect, useState, useCallback } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  View,
  RefreshControl,
} from 'react-native';
import { AppText, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useHealthDataStore } from '../store/healthDataStore';
import { useStepDebugStore } from '../store/stepDebugStore';
import { getLocalToday } from '../../../utils/date';
import { useNavigation } from '@react-navigation/native';
import { withOpacity } from '../../../utils/withOpacity';
import {
  resolveSteps,
  detectServerEcho,
  minutesSinceLocalMidnight,
  labelFor,
  MAX_PLAUSIBLE_DAILY_STEPS,
  type StepResolution,
  type StepSourceAudit,
  type ServerSourceInput,
  type StepSourceInput,
} from '../service/stepEngine';
import {
  OWN_PACKAGE,
  todayRange,
  type StepOriginTotal,
  type StepsReadResult,
} from '../service/healthConnect.service';
import type { StepDiagnostics } from '../../../services/stepService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveResolve {
  resolution: StepResolution;
  origins: StepOriginTotal[];
  method: string;
  largestOrigin: number;
  originSum: number;
  at: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const StepSourcesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();

  // The decision the app is actually displaying, straight from the pipeline.
  const pipelineSnapshot = useStepDebugStore(s => s.snapshot);
  const store = useHealthDataStore();

  const [live, setLive] = useState<LiveResolve | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debugLog, setDebugLog] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<StepDiagnostics | null>(null);

  /**
   * Re-runs the resolution using the SAME functions the pipeline uses.
   *
   * Every source is gathered exactly as `useHealth.loadData` gathers it, then
   * handed to the same `resolveSteps`. That is the point: this screen must not
   * contain a second opinion about how steps are counted.
   */
  const resolveNow = useCallback(async () => {
    try {
      const today = getLocalToday();

      // ── Health Connect / HealthKit ──────────────────────────────────────────
      let primary: StepSourceInput = { steps: 0, available: false };
      let origins: StepOriginTotal[] = [];
      let method = 'not-used';
      let largestOrigin = 0;
      let originSum = 0;

      if (Platform.OS === 'android') {
        try {
          const { readTodayStepsDetailed } = await import('../service/healthConnect.service');
          const range = todayRange();
          const read: StepsReadResult = await readTodayStepsDetailed(range.startTime, range.endTime);
          primary = { steps: read.steps, available: read.available };
          origins = read.origins;
          method = read.method;
          largestOrigin = read.largestOrigin;
          originSum = read.originSum;
        } catch (e) {
          console.warn('[StepSources] Health Connect read failed:', e);
        }
      } else if (Platform.OS === 'ios') {
        try {
          const { fetchAllHealthKitData } = await import('../service/healthkit.service');
          const hk = await fetchAllHealthKitData();
          primary = { steps: hk.steps, available: hk.steps > 0 };
          origins = [{ packageName: 'Apple HealthKit', steps: hk.steps }];
          method = 'healthkit';
          largestOrigin = hk.steps;
          originSum = hk.steps;
        } catch (e) {
          console.warn('[StepSources] HealthKit read failed:', e);
        }
      }

      // ── Native sensor ───────────────────────────────────────────────────────
      let nativeSensor: StepSourceInput = { steps: 0, available: false };
      try {
        const { stepService } = await import('../../../services/stepService');
        nativeSensor = { steps: await stepService.getCurrentSteps(), available: true };
      } catch (e) {
        console.warn('[StepSources] Native sensor read failed:', e);
      }

      // ── Server, with bonus removed and echo detected ────────────────────────
      const hasServerToday =
        !!store.syncedServerBaseline && store.syncedServerBaselineDate === today;
      const bonusSteps = store.bonusStepsDate === today ? Math.max(0, store.bonusSteps || 0) : 0;
      const serverDeviceSteps = hasServerToday
        ? Math.max(0, (store.syncedServerBaseline!.steps || 0) - bonusSteps)
        : 0;
      const server: ServerSourceInput = {
        steps: serverDeviceSteps,
        available: hasServerToday,
        isEcho: hasServerToday
          ? detectServerEcho(serverDeviceSteps, store.lastPushedSteps, store.lastPushedStepsDate)
          : null,
      };

      const resolution = resolveSteps({
        healthConnect: primary,
        nativeSensor,
        server,
        bonusSteps,
        minutesElapsedToday: minutesSinceLocalMidnight(),
      });

      setLive({ resolution, origins, method, largestOrigin, originSum, at: Date.now() });
    } catch (e) {
      console.warn('[StepSources] resolveNow failed:', e);
    } finally {
      setLoading(false);
      try {
        const { stepService } = await import('../../../services/stepService');
        setDebugLog(await stepService.getDebugLog());
        setDiagnostics(await stepService.getDiagnostics());
      } catch {
        setDebugLog('(failed to load)');
      }
    }
  }, [store]);

  useEffect(() => {
    resolveNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Force a fresh Health Connect read rather than the 30s memo.
    try {
      const { resetStepCache } = await import('../service/healthConnect.service');
      resetStepCache();
    } catch { /* non-fatal */ }
    await resolveNow();
    setRefreshing(false);
  }, [resolveNow]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e5e5e5';

  const pipeline = pipelineSnapshot?.resolution ?? null;
  const shown = pipeline ?? live?.resolution ?? null;
  const originList = pipelineSnapshot?.hcOrigins?.length
    ? pipelineSnapshot.hcOrigins
    : live?.origins ?? [];

  return (
    <Screen>
      <Header title="Step Sources" showBack onBackPress={() => navigation.goBack()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ── The number on screen, and how it was reached ──────────────────── */}
        <View style={[styles.finalCard, { backgroundColor: cardBg, borderColor }]}>
          <AppText variant="caption1" secondary>
            DISPLAYED STEPS
          </AppText>
          <AppText
            variant="largeTitle"
            weight="bold"
            style={{ color: colors.primary, marginTop: 4 }}
          >
            {(shown?.displaySteps ?? 0).toLocaleString()}
          </AppText>
          {shown ? (
            <>
              <AppText variant="caption1" secondary style={{ marginTop: 6, textAlign: 'center' }}>
                {shown.explanation}
              </AppText>
              <AppText variant="caption2" secondary style={{ marginTop: 6, textAlign: 'center' }}>
                {shown.deviceSteps.toLocaleString()} device
                {shown.bonusSteps > 0 ? ` + ${shown.bonusSteps.toLocaleString()} bonus` : ''}
                {' = '}
                {shown.displaySteps.toLocaleString()} displayed
              </AppText>
              <AppText variant="caption2" secondary style={{ marginTop: 2 }}>
                {pipeline
                  ? `Pipeline decision · ${formatAge(pipelineSnapshot!.at)}`
                  : 'Live re-resolve (pipeline has not run yet)'}
              </AppText>
            </>
          ) : (
            <AppText variant="caption1" secondary style={{ marginTop: 6 }}>
              {loading ? 'Reading sources…' : 'No resolution available'}
            </AppText>
          )}
        </View>

        {/* ── Explanation of the model ──────────────────────────────────────── */}
        <View
          style={[
            styles.explainCard,
            {
              backgroundColor: withOpacity(colors.primary, 0.08),
              borderColor: withOpacity(colors.primary, 0.2),
            },
          ]}
        >
          <AppText variant="footnote" weight="semiBold" style={{ color: colors.primary }}>
            How the count is decided
          </AppText>
          <AppText variant="caption1" secondary style={{ marginTop: 4, lineHeight: 18 }}>
            Every source reports the FULL local day, then the highest trusted source
            wins. Sources are never added together.{'\n'}
            {'\n'}
            • Health Connect — deduplicated across data origins; our own records are
            excluded{'\n'}
            • Native sensor — rejected if it runs more than 2x ahead of Health
            Connect (drifted counter){'\n'}
            • Server — a floor only, ignored when it is just this device's own last
            sync coming back{'\n'}
            • Anything above {MAX_PLAUSIBLE_DAILY_STEPS.toLocaleString()} steps, or
            faster than 220 steps/min for the time elapsed today, is rejected{'\n'}
            • Bonus steps are added at the end, for display only
          </AppText>
        </View>

        {/* ── Accepted sources ──────────────────────────────────────────────── */}
        <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
          Accepted Sources
        </AppText>
        {shown && shown.accepted.length > 0 ? (
          shown.accepted.map(source => (
            <AuditCard
              key={source.id}
              audit={source}
              isWinner={source.id === shown.winner}
              accepted
              cardBg={cardBg}
              borderColor={borderColor}
            />
          ))
        ) : (
          <View style={[styles.sourceCard, { backgroundColor: cardBg, borderColor }]}>
            <AppText variant="caption1" secondary>
              None — every source was unavailable or reported 0.
            </AppText>
          </View>
        )}

        {/* ── Rejected sources: the reason a number looks wrong ─────────────── */}
        <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
          Rejected Sources
        </AppText>
        {shown && shown.rejected.length > 0 ? (
          shown.rejected.map(source => (
            <AuditCard
              key={`${source.id}-rejected`}
              audit={source}
              isWinner={false}
              accepted={false}
              cardBg={cardBg}
              borderColor={borderColor}
            />
          ))
        ) : (
          <View style={[styles.sourceCard, { backgroundColor: cardBg, borderColor }]}>
            <AppText variant="caption1" secondary>
              None — every source passed its checks.
            </AppText>
          </View>
        )}

        {/* ── Live re-resolve, for comparison with the pipeline ─────────────── */}
        {live && pipeline && (
          <>
            <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
              Live Re-resolve
            </AppText>
            <View style={[styles.debugCard, { backgroundColor: cardBg, borderColor }]}>
              <AppText variant="caption1" secondary style={{ marginBottom: 8 }}>
                Same engine, run just now. A difference means the sources moved
                between the two reads, not that two algorithms disagree.
              </AppText>
              <DebugRow
                label="Device steps"
                value={`${live.resolution.deviceSteps.toLocaleString()} (pipeline: ${pipeline.deviceSteps.toLocaleString()})`}
                colors={colors}
              />
              <DebugRow label="Winner" value={labelFor(live.resolution.winner)} colors={colors} />
              <DebugRow label="Decision" value={live.resolution.explanation} colors={colors} multiline />
            </View>
          </>
        )}

        {/* ── Health Connect per-origin breakdown ───────────────────────────── */}
        {originList.length > 0 && (
          <>
            <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
              {Platform.OS === 'ios' ? 'HealthKit Sources' : 'Health Connect Origins'}
            </AppText>
            <AppText variant="caption1" secondary style={{ marginBottom: 8 }}>
              Raw totals per data origin. The deduplicated figure is bounded to
              [largest origin, sum of origins], so it can never exceed what the
              records actually contain.
            </AppText>

            {live && (
              <View
                style={[styles.debugCard, { backgroundColor: cardBg, borderColor, marginBottom: 10 }]}
              >
                <DebugRow label="Method" value={live.method} colors={colors} />
                <DebugRow
                  label="Largest origin"
                  value={live.largestOrigin.toLocaleString()}
                  colors={colors}
                />
                <DebugRow
                  label="Sum of origins"
                  value={live.originSum.toLocaleString()}
                  colors={colors}
                />
                <DebugRow
                  label="Deduplicated"
                  value={live.resolution.accepted
                    .concat(live.resolution.rejected)
                    .find(a => a.id === 'health_connect')
                    ?.steps.toLocaleString() ?? '—'}
                  colors={colors}
                />
              </View>
            )}

            {[...originList]
              .sort((a, b) => b.steps - a.steps)
              .map(origin => {
                const isOwnApp = origin.packageName === OWN_PACKAGE;
                return (
                  <View
                    key={origin.packageName}
                    style={[
                      styles.originCard,
                      { backgroundColor: cardBg, borderColor },
                      isOwnApp && { borderColor: '#FF5722', borderWidth: 1.5, opacity: 0.6 },
                    ]}
                  >
                    <View style={styles.originRow}>
                      <View style={{ flex: 1 }}>
                        <AppText variant="label" weight="medium" numberOfLines={1}>
                          {formatOriginName(origin.packageName)}
                          {isOwnApp ? ' (SELF)' : ''}
                        </AppText>
                        <AppText variant="caption2" secondary numberOfLines={1}>
                          {origin.packageName}
                        </AppText>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <AppText
                          variant="body"
                          weight="bold"
                          style={{
                            color: isOwnApp ? '#FF5722' : colors.foreground,
                            textDecorationLine: isOwnApp ? 'line-through' : 'none',
                          }}
                        >
                          {origin.steps.toLocaleString()}
                        </AppText>
                        {isOwnApp && (
                          <AppText variant="caption2" style={{ color: '#FF5722' }}>
                            ✗ EXCLUDED
                          </AppText>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
          </>
        )}

        {/* ── Store state ───────────────────────────────────────────────────── */}
        <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
          Store Debug Info
        </AppText>
        <View style={[styles.debugCard, { backgroundColor: cardBg, borderColor }]}>
          <DebugRow label="Today (local)" value={getLocalToday()} colors={colors} />
          <DebugRow label="Platform" value={pipelineSnapshot?.platform ?? '—'} colors={colors} />
          <DebugRow label="Persisted data.steps" value={String(store.data?.steps ?? 0)} colors={colors} />
          <DebugRow label="Login Timestamp" value={formatTimestamp(store.loginTimestamp)} colors={colors} />
          <DebugRow label="Last Fetched At" value={formatTimestamp(store.lastFetchedAt)} colors={colors} />
          <DebugRow label="Step Offset Fetched" value={String(store.stepOffsetFetched)} colors={colors} />
          <DebugRow label="Synced Baseline Date" value={store.syncedServerBaselineDate || '—'} colors={colors} />
          <DebugRow label="Bonus Steps / Date" value={`${store.bonusSteps} / ${store.bonusStepsDate || '—'}`} colors={colors} />
          <DebugRow
            label="Last Pushed / Date"
            value={`${store.lastPushedSteps} / ${store.lastPushedStepsDate || '—'}`}
            colors={colors}
          />
          <DebugRow
            label="Baseline All Fields"
            value={JSON.stringify(store.syncedServerBaseline, null, 2) || '—'}
            colors={colors}
            multiline
          />
        </View>

        {/* ── Device diagnostics ────────────────────────────────────────────── */}
        {diagnostics && (
          <>
            <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
              Device Diagnostics
            </AppText>
            <View style={[styles.debugCard, { backgroundColor: cardBg, borderColor }]}>
              <DebugRow label="API Level" value={`${diagnostics.device?.apiLevel} (Android ${diagnostics.device?.androidVersion})`} colors={colors} />
              <DebugRow label="Manufacturer" value={diagnostics.device?.manufacturer ?? '—'} colors={colors} />
              <DebugRow label="Model" value={diagnostics.device?.model ?? '—'} colors={colors} />
              <DebugRow label="SoC / Board" value={`${diagnostics.device?.soc ?? '?'} / ${diagnostics.device?.board ?? '?'}`} colors={colors} />
              <DebugRow label="Permission" value={`${diagnostics.permission?.permissionStatus} (required: ${diagnostics.permission?.activityRecognitionRequired})`} colors={colors} />
              <DebugRow label="Sensor Available" value={`Counter: ${diagnostics.sensor?.stepCounterAvailable}, Detector: ${diagnostics.sensor?.stepDetectorAvailable}`} colors={colors} />
              <DebugRow label="Sensor Name" value={diagnostics.sensor?.sensorName ?? 'N/A'} colors={colors} />
              <DebugRow label="Wake-up Sensor" value={String(diagnostics.sensor?.isWakeUpSensor ?? 'N/A')} colors={colors} />
              <DebugRow label="FIFO (max/reserved)" value={`${diagnostics.sensor?.fifoMaxCount ?? '?'} / ${diagnostics.sensor?.fifoReservedCount ?? '?'}`} colors={colors} />
              <DebugRow label="Service Running" value={String(diagnostics.service?.serviceRunning)} colors={colors} />
              <DebugRow label="Live Steps" value={String(diagnostics.service?.liveStepCount)} colors={colors} />
              <DebugRow label="Display Floor" value={String(diagnostics.service?.displayStepFloor ?? 0)} colors={colors} />
              <DebugRow label="Sensor Events" value={String(diagnostics.service?.sensorEventCount ?? 0)} colors={colors} />
              <DebugRow label="Last Event (sec ago)" value={(diagnostics.service?.secondsSinceLastSensorEvent ?? -1) >= 0 ? `${diagnostics.service?.secondsSinceLastSensorEvent}s` : 'never'} colors={colors} />
              <DebugRow label="Re-registrations" value={String(diagnostics.service?.reregisterCount ?? 0)} colors={colors} />
              <DebugRow label="HC Fallback Active" value={String(diagnostics.service?.hcPollingMode ?? false)} colors={colors} />
              <DebugRow label="Poll-by-reregister" value={String(diagnostics.service?.pollByReregisterMode ?? false)} colors={colors} />
              <DebugRow label="Flush Supported" value={String(diagnostics.service?.sensorSupportsFlush ?? false)} colors={colors} />
              <DebugRow label="Battery Exempt" value={String(diagnostics.battery?.ignoringBatteryOptimization)} colors={colors} />
              <DebugRow label="Doze Mode" value={String(diagnostics.battery?.isDeviceIdleMode)} colors={colors} />
              <DebugRow label="Power Save" value={String(diagnostics.battery?.isPowerSaveMode)} colors={colors} />
              <DebugRow label="Baseline" value={String(diagnostics.stepState?.baseline ?? 0)} colors={colors} />
              <DebugRow label="Daily Steps (prefs)" value={String(diagnostics.stepState?.dailySteps ?? 0)} colors={colors} />
              <DebugRow label="Reboot Offset" value={String(diagnostics.stepState?.rebootOffset ?? 0)} colors={colors} />
              <DebugRow label="Stored Date" value={diagnostics.stepState?.storedDate ?? '—'} colors={colors} />
            </View>
          </>
        )}

        {/* ── Native service log ────────────────────────────────────────────── */}
        {debugLog ? (
          <>
            <AppText variant="headline" weight="semiBold" style={styles.sectionTitle}>
              Native Service Log
            </AppText>
            <View style={[styles.debugCard, { backgroundColor: cardBg, borderColor }]}>
              <AppText
                variant="caption2"
                style={{
                  color: colors.foreground,
                  fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                  fontSize: 9,
                  lineHeight: 14,
                }}
              >
                {debugLog}
              </AppText>
            </View>
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const AuditCard = ({
  audit,
  isWinner,
  accepted,
  cardBg,
  borderColor,
}: {
  audit: StepSourceAudit;
  isWinner: boolean;
  accepted: boolean;
  cardBg: string;
  borderColor: string;
}) => {
  const accent = accepted ? (isWinner ? '#4CAF50' : '#2196F3') : '#FF5722';
  return (
    <View
      style={[
        styles.sourceCard,
        { backgroundColor: cardBg, borderColor },
        { borderLeftColor: accent, borderLeftWidth: 4 },
      ]}
    >
      <View style={styles.sourceHeader}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <AppText variant="body" weight="semiBold" style={{ flex: 1 }}>
          {labelFor(audit.id)}
        </AppText>
        <AppText
          variant="title3"
          weight="bold"
          style={{
            color: accent,
            textDecorationLine: accepted ? 'none' : 'line-through',
          }}
        >
          {audit.steps.toLocaleString()}
        </AppText>
      </View>
      <AppText variant="caption1" secondary style={{ marginTop: 4, marginLeft: 20 }}>
        {audit.reason}
      </AppText>
      {isWinner && (
        <AppText variant="caption2" style={{ marginTop: 2, marginLeft: 20, color: accent }}>
          ✓ USED AS THE DEVICE STEP COUNT
        </AppText>
      )}
    </View>
  );
};

const DebugRow = ({
  label,
  value,
  colors,
  multiline = false,
}: {
  label: string;
  value: string;
  colors: any;
  multiline?: boolean;
}) => (
  <View style={[styles.debugRow, multiline && { flexDirection: 'column', alignItems: 'flex-start' }]}>
    <AppText variant="caption1" secondary style={{ minWidth: 130 }}>
      {label}
    </AppText>
    <AppText
      variant="caption1"
      style={[
        { color: colors.foreground, flex: 1 },
        multiline && {
          marginTop: 4,
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: 10,
        },
      ]}
      numberOfLines={multiline ? undefined : 1}
    >
      {value}
    </AppText>
  </View>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOriginName(pkg: string): string {
  const knownNames: Record<string, string> = {
    'com.samsung.shealth': 'Samsung Health',
    'com.sec.android.app.shealth': 'Samsung Health (Legacy)',
    'com.google.android.apps.fitness': 'Google Fit',
    'com.google.android.gms': 'Google Play Services (Sensor)',
    'com.sweatco.sweatcoin': 'Sweatcoin',
    'in.sweatco.app': 'Sweatcoin',
    'com.xiaomi.wearable': 'Mi Fitness',
    'com.huawei.health': 'Huawei Health',
    'com.athlofit.athlofit': 'Athlofit (this app)',
    unknown: 'Unknown Origin',
  };
  if (knownNames[pkg]) return knownNames[pkg];
  // Health Connect reports the platform pedometer under an opaque id.
  if (pkg.startsWith('com.android.healthconnect')) return 'Android platform pedometer';
  return pkg.split('.').pop() || pkg;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

function formatAge(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  content: { padding: 16 },
  finalCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 12,
  },
  explainCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
  },
  sourceCard: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  sourceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  originCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  debugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
});

export default StepSourcesScreen;
