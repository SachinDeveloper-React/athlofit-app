// src/features/health/screens/StepSourcesScreen.tsx
//
// Debugging screen that shows ALL sources contributing to the step count.
// Helps identify where phantom/extra steps are coming from.

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
import { getLocalToday } from '../../../utils/date';
import { useNavigation } from '@react-navigation/native';
import { withOpacity } from '../../../utils/withOpacity';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepSource {
  id: string;
  label: string;
  description: string;
  steps: number | string;
  isActive: boolean; // whether this source is currently contributing
  color: string;
}

interface HealthConnectOrigin {
  packageName: string;
  steps: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

const StepSourcesScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation();

  const [sources, setSources] = useState<StepSource[]>([]);
  const [hcOrigins, setHcOrigins] = useState<HealthConnectOrigin[]>([]);
  const [finalSteps, setFinalSteps] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadSources = useCallback(async () => {
    try {
      const store = useHealthDataStore.getState();
      const today = getLocalToday();

      // ── 1. Health Connect / HealthKit raw reading ─────────────────────────
      let healthConnectSteps = 0;
      let origins: HealthConnectOrigin[] = [];

      if (Platform.OS === 'android') {
        try {
          const { readRecords } = await import(
            'react-native-health-connect'
          );
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const now = new Date();

          const { records } = await readRecords('Steps', {
            timeRangeFilter: {
              operator: 'between' as const,
              startTime: startOfDay.toISOString(),
              endTime: now.toISOString(),
            },
          });

          if (records && records.length > 0) {
            // Group by data origin (same logic as readStepsDeduped)
            const totals: Record<string, number> = {};
            const requestedStart = startOfDay.getTime();

            for (const r of records) {
              const recStart = new Date((r as any).startTime).getTime();
              if (recStart < requestedStart) continue; // midnight bleed guard

              const origin = (r as any).metadata?.dataOrigin ?? 'unknown';
              totals[origin] = (totals[origin] ?? 0) + ((r as any).count ?? 0);
            }

            origins = Object.entries(totals).map(([pkg, steps]) => ({
              packageName: pkg,
              steps,
            }));

            // FIX: Exclude our own package (same logic as readStepsDeduped)
            const OWN_PACKAGE = 'com.athlofit.athlofit';
            const externalOrigins = origins.filter(o => o.packageName !== OWN_PACKAGE);

            // Deduped value = max single EXTERNAL source (excluding self)
            healthConnectSteps = externalOrigins.length > 0
              ? Math.max(...externalOrigins.map(o => o.steps))
              : origins.length > 0
                ? Math.max(...origins.map(o => o.steps))
                : 0;
          }
        } catch (e) {
          console.warn('[StepSources] HC read failed:', e);
        }
      } else if (Platform.OS === 'ios') {
        // iOS HealthKit
        try {
          const { fetchAllHealthKitData } = await import(
            '../service/healthkit.service'
          );
          const hkData = await fetchAllHealthKitData();
          healthConnectSteps = hkData.steps;
          origins = [{ packageName: 'Apple HealthKit', steps: hkData.steps }];
        } catch (e) {
          console.warn('[StepSources] HK read failed:', e);
        }
      }

      setHcOrigins(origins);

      // ── 2. Native Step Sensor ─────────────────────────────────────────────
      let nativeSensorSteps = 0;
      try {
        const { stepService } = await import('../../../services/stepService');
        nativeSensorSteps = await stepService.getCurrentSteps();
      } catch (e) {
        console.warn('[StepSources] Native sensor read failed:', e);
      }

      // ── 3. Server Baseline (from GET /health/today on login) ──────────────
      const serverBaseline = store.syncedServerBaseline;
      const serverBaselineDate = store.syncedServerBaselineDate;
      const serverBaselineSteps =
        serverBaseline && serverBaselineDate === today
          ? serverBaseline.steps
          : 0;

      // ── 4. Synced Step Offset (server_steps - native_steps at login) ──────
      const syncedStepOffset =
        store.syncedStepOffsetDate === today ? store.syncedStepOffset : 0;

      // ── 5. Bonus Steps (admin/system credited) ────────────────────────────
      const bonusSteps =
        store.bonusStepsDate === today ? store.bonusSteps : 0;

      // ── 6. Cached/Displayed steps ─────────────────────────────────────────
      const displayedSteps = store.data?.steps ?? 0;

      // ── Build sources list ────────────────────────────────────────────────
      const allSources: StepSource[] = [
        {
          id: 'health_connect',
          label: Platform.OS === 'ios' ? 'Apple HealthKit' : 'Health Connect (Deduped)',
          description: Platform.OS === 'ios'
            ? 'Steps read from Apple HealthKit'
            : 'Max single-source from Health Connect records',
          steps: healthConnectSteps,
          isActive: healthConnectSteps > 0,
          color: '#4CAF50',
        },
        {
          id: 'native_sensor',
          label: 'Native Step Sensor',
          description: 'Hardware pedometer (TYPE_STEP_COUNTER)',
          steps: nativeSensorSteps,
          isActive: nativeSensorSteps > 0,
          color: '#2196F3',
        },
        {
          id: 'server_baseline',
          label: 'Server Baseline',
          description: `From GET /health/today on login (date: ${serverBaselineDate || 'none'})`,
          steps: serverBaselineSteps,
          isActive: serverBaselineSteps > 0 && serverBaselineDate === today,
          color: '#FF9800',
        },
        {
          id: 'step_offset',
          label: 'Synced Step Offset',
          description: `server_steps - native_steps at login time (date: ${store.syncedStepOffsetDate || 'none'})`,
          steps: syncedStepOffset,
          isActive: syncedStepOffset > 0,
          color: '#9C27B0',
        },
        {
          id: 'bonus_steps',
          label: 'Bonus Steps (Admin)',
          description: 'Steps credited by admin/system (rewards, challenges)',
          steps: bonusSteps,
          isActive: bonusSteps > 0,
          color: '#E91E63',
        },
      ];

      setSources(allSources);
      setFinalSteps(displayedSteps);
    } catch (e) {
      console.warn('[StepSources] loadSources error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSources();
    setRefreshing(false);
  }, [loadSources]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e5e5e5';

  return (
    <Screen>
      <Header
        title="Step Sources"
        showBack
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Final displayed value */}
        <View style={[styles.finalCard, { backgroundColor: cardBg, borderColor }]}>
          <AppText variant="caption1" secondary>
            FINAL DISPLAYED STEPS
          </AppText>
          <AppText variant="largeTitle" weight="bold" style={{ color: colors.primary, marginTop: 4 }}>
            {finalSteps.toLocaleString()}
          </AppText>
          <AppText variant="caption1" secondary style={{ marginTop: 4 }}>
            Logic: max(HealthConnect, NativeSensor) → then max(result, ServerBaseline)
          </AppText>
          <AppText variant="caption1" secondary>
            + StepOffset (in native_sensor mode only)
          </AppText>
        </View>

        {/* Explanation */}
        <View style={[styles.explainCard, { backgroundColor: withOpacity(colors.primary, 0.08), borderColor: withOpacity(colors.primary, 0.2) }]}>
          <AppText variant="footnote" weight="semiBold" style={{ color: colors.primary }}>
            How steps are calculated:
          </AppText>
          <AppText variant="caption1" secondary style={{ marginTop: 4, lineHeight: 18 }}>
            1. Read Health Connect (picks max single EXTERNAL origin){'\n'}
            {'   '}• Own app records (com.athlofit.athlofit) are EXCLUDED{'\n'}
            2. Compare with Native Sensor → take higher{'\n'}
            3. Apply Server Baseline → max(local, server){'\n'}
            {'   '}• Inflation guard: skip if server {'>'} 2x local{'\n'}
            4. In native_sensor mode: add Step Offset{'\n'}
            5. Bonus Steps are added server-side to total
          </AppText>
        </View>

        {/* Individual sources */}
        <AppText variant="headline" weight="semiBold" style={{ marginTop: 20, marginBottom: 12 }}>
          Individual Sources
        </AppText>

        {sources.map((source) => (
          <View
            key={source.id}
            style={[
              styles.sourceCard,
              { backgroundColor: cardBg, borderColor },
              source.isActive && { borderLeftColor: source.color, borderLeftWidth: 4 },
            ]}
          >
            <View style={styles.sourceHeader}>
              <View style={[styles.dot, { backgroundColor: source.isActive ? source.color : '#999' }]} />
              <AppText variant="body" weight="semiBold" style={{ flex: 1 }}>
                {source.label}
              </AppText>
              <AppText
                variant="title3"
                weight="bold"
                style={{ color: source.isActive ? source.color : colors.mutedForeground }}
              >
                {typeof source.steps === 'number' ? source.steps.toLocaleString() : source.steps}
              </AppText>
            </View>
            <AppText variant="caption1" secondary style={{ marginTop: 4, marginLeft: 20 }}>
              {source.description}
            </AppText>
            {!source.isActive && (
              <AppText variant="caption2" style={{ marginTop: 2, marginLeft: 20, color: '#999' }}>
                (not active / 0 steps)
              </AppText>
            )}
          </View>
        ))}

        {/* Health Connect per-origin breakdown */}
        {hcOrigins.length > 0 && (
          <>
            <AppText variant="headline" weight="semiBold" style={{ marginTop: 24, marginBottom: 12 }}>
              {Platform.OS === 'ios' ? 'HealthKit Sources' : 'Health Connect Origins'}
            </AppText>
            <AppText variant="caption1" secondary style={{ marginBottom: 8 }}>
              Raw records grouped by data origin. Own app records are EXCLUDED from deduplication.
            </AppText>

            {hcOrigins
              .sort((a, b) => b.steps - a.steps)
              .map((origin, idx) => {
                const OWN_PACKAGE = 'com.athlofit.athlofit';
                const isOwnApp = origin.packageName === OWN_PACKAGE;
                const externalOrigins = hcOrigins.filter(o => o.packageName !== OWN_PACKAGE);
                const maxExternal = externalOrigins.length > 0
                  ? Math.max(...externalOrigins.map(o => o.steps))
                  : 0;
                const isUsed = !isOwnApp && origin.steps === maxExternal && origin.steps > 0;

                return (
                  <View
                    key={origin.packageName}
                    style={[
                      styles.originCard,
                      { backgroundColor: cardBg, borderColor },
                      isUsed && { borderColor: '#4CAF50', borderWidth: 1.5 },
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
                            color: isOwnApp ? '#FF5722' : isUsed ? '#4CAF50' : colors.foreground,
                            textDecorationLine: isOwnApp ? 'line-through' : 'none',
                          }}
                        >
                          {origin.steps.toLocaleString()}
                        </AppText>
                        {isUsed && (
                          <AppText variant="caption2" style={{ color: '#4CAF50' }}>
                            ✓ USED
                          </AppText>
                        )}
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

        {/* Store debug info */}
        <AppText variant="headline" weight="semiBold" style={{ marginTop: 24, marginBottom: 12 }}>
          Store Debug Info
        </AppText>
        <View style={[styles.debugCard, { backgroundColor: cardBg, borderColor }]}>
          <DebugRow label="Today (local)" value={getLocalToday()} colors={colors} />
          <DebugRow label="Login Timestamp" value={formatTimestamp(useHealthDataStore.getState().loginTimestamp)} colors={colors} />
          <DebugRow label="Last Fetched At" value={formatTimestamp(useHealthDataStore.getState().lastFetchedAt)} colors={colors} />
          <DebugRow label="Step Offset Fetched" value={String(useHealthDataStore.getState().stepOffsetFetched)} colors={colors} />
          <DebugRow label="Synced Offset Date" value={useHealthDataStore.getState().syncedStepOffsetDate || '—'} colors={colors} />
          <DebugRow label="Synced Baseline Date" value={useHealthDataStore.getState().syncedServerBaselineDate || '—'} colors={colors} />
          <DebugRow label="Bonus Steps Date" value={useHealthDataStore.getState().bonusStepsDate || '—'} colors={colors} />
          <DebugRow
            label="Baseline All Fields"
            value={JSON.stringify(useHealthDataStore.getState().syncedServerBaseline, null, 2) || '—'}
            colors={colors}
            multiline
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Screen>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatOriginName(pkg: string): string {
  const knownNames: Record<string, string> = {
    'com.samsung.shealth': 'Samsung Health',
    'com.google.android.apps.fitness': 'Google Fit',
    'com.google.android.gms': 'Google Play Services (Sensor)',
    'com.sec.android.app.shealth': 'Samsung Health (Legacy)',
    'com.sweatco.sweatcoin': 'Sweatcoin',
    'com.xiaomi.wearable': 'Mi Fitness',
    'com.huawei.health': 'Huawei Health',
    'unknown': 'Unknown Origin',
  };
  return knownNames[pkg] || pkg.split('.').pop() || pkg;
}

function formatTimestamp(ts: number | null): string {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

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
        multiline && { marginTop: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10 },
      ]}
      numberOfLines={multiline ? undefined : 1}
    >
      {value}
    </AppText>
  </View>
);

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
