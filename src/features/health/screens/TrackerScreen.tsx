// import React from 'react';
// import {
//   View,
//   Text,
//   ScrollView,
//   RefreshControl,
//   TouchableOpacity,
//   StyleSheet,
//   ActivityIndicator,
//   Pressable,
// } from 'react-native';
// import { useHealth } from '../hooks/useHealth';
// import { useAuthStore } from '../../auth/store/authStore';
// import { HealthRoutes } from '../../../navigation/routes';
// import { HealthStackScreenProps } from '../../../types/navigation.types';
// import { useNavigation } from '@react-navigation/native';

// type Props = HealthStackScreenProps<typeof HealthRoutes.TRACKER>;

// const getBPStatus = (sys: number, dia: number) => {
//   if (!sys) return null;
//   if (sys < 120 && dia < 80)
//     return { label: 'Normal', color: '#3B6D11', bg: '#EAF3DE' };
//   if (sys < 130) return { label: 'Elevated', color: '#854F0B', bg: '#FAEEDA' };
//   if (sys < 140)
//     return { label: 'High Stage 1', color: '#D85A30', bg: '#FAECE7' };
//   return { label: 'High Stage 2', color: '#A32D2D', bg: '#FCEBEB' };
// };

// const getHRZone = (bpm: number) => {
//   if (!bpm) return null;
//   if (bpm < 60) return { label: 'Low', color: '#185FA5', bg: '#E6F1FB' };
//   if (bpm <= 100) return { label: 'Normal', color: '#3B6D11', bg: '#EAF3DE' };
//   return { label: 'High', color: '#A32D2D', bg: '#FCEBEB' };
// };

// function Badge({
//   label,
//   color,
//   bg,
// }: {
//   label: string;
//   color: string;
//   bg: string;
// }) {
//   return (
//     <View style={[styles.badge, { backgroundColor: bg }]}>
//       <Text style={[styles.badgeText, { color }]}>{label}</Text>
//     </View>
//   );
// }

// function MetricCard({ label, value, unit, sub, badge }: any) {
//   return (
//     <View style={styles.card}>
//       <Text style={styles.cardLabel}>{label}</Text>
//       <View style={styles.cardValueRow}>
//         <Text style={styles.cardValue}>{value ?? '—'}</Text>
//         {unit ? <Text style={styles.cardUnit}> {unit}</Text> : null}
//       </View>
//       {badge ? <Badge {...badge} /> : null}
//       {sub && !badge ? <Text style={styles.cardSub}>{sub}</Text> : null}
//     </View>
//   );
// }

// function ProgressBar({
//   value,
//   max,
//   color,
// }: {
//   value: number;
//   max: number;
//   color: string;
// }) {
//   const pct = Math.min((value / max) * 100, 100);
//   return (
//     <View style={styles.progressBg}>
//       <View
//         style={[
//           styles.progressFill,
//           { width: `${pct}%` as any, backgroundColor: color },
//         ]}
//       />
//     </View>
//   );
// }

// export default function TrackerScreen() {
//   const navigation = useNavigation<Props['navigation']>();
//   const weightKg = useAuthStore(state => state.user?.weight);
//   const { platform, isReady, isLoading, data, error, refresh } = useHealth({
//     weightKg: Number(weightKg),
//   });
//   console.log('123', platform, isReady, isLoading, data, error, refresh);

//   const bpStatus = getBPStatus(
//     data.bloodPressureSystolic,
//     data.bloodPressureDiastolic,
//   );
//   const hrZone = getHRZone(data.heartRate);

//   if (isLoading && !isReady) {
//     return (
//       <View style={styles.center}>
//         <ActivityIndicator size="large" color="#1a1a1a" />
//         <Text style={styles.loadingText}>Connecting to health data…</Text>
//       </View>
//     );
//   }

//   if (!isReady || error) {
//     return (
//       <View style={styles.center}>
//         <Text style={styles.errorTitle}>
//           {error ?? 'Health data unavailable'}
//         </Text>
//         <TouchableOpacity style={styles.btn} onPress={refresh}>
//           <Text style={styles.btnText}>Try Again</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   const platformLabel =
//     platform === 'healthkit' ? '🍎 Apple HealthKit' : '🤖 Health Connect';

//   console.log('data', data);
//   return (
//     <ScrollView
//       style={styles.container}
//       contentContainerStyle={{ paddingBottom: 40 }}
//       refreshControl={
//         <RefreshControl
//           refreshing={isLoading}
//           onRefresh={refresh}
//           tintColor="#1a1a1a"
//         />
//       }
//     >
//       {/* Header */}
//       <View style={styles.header}>
//         <View>
//           <Text style={styles.title}>Health Dashboard</Text>
//           <Text style={styles.platformBadge}>{platformLabel}</Text>
//         </View>
//         {isLoading && <ActivityIndicator color="#888" />}
//       </View>

//       {/* Activity */}
//       <Text style={styles.sectionTitle}>Activity</Text>
//       <View style={styles.row}>
//         <View style={[styles.card, { flex: 1 }]}>
//           <Text style={styles.cardLabel}>Steps</Text>
//           <Text style={styles.cardValue}>{data.steps.toLocaleString()}</Text>
//           <ProgressBar value={data.steps} max={10000} color="#639922" />
//           <Text style={styles.cardSub}>
//             {Math.round((data.steps / 10000) * 100)}% of 10,000
//           </Text>
//         </View>
//         <MetricCard
//           label="Distance"
//           value={data.distance}
//           unit="km"
//           sub="Today"
//         />
//       </View>

//       <View style={styles.row}>
//         <View style={[styles.card, { flex: 1 }]}>
//           <Text style={styles.cardLabel}>Calories</Text>
//           <Text style={styles.cardValue}>
//             {data.calories} <Text style={styles.cardUnit}>kcal</Text>
//           </Text>
//           <ProgressBar value={data.calories} max={800} color="#BA7517" />
//           <Text style={styles.cardSub}>
//             {Math.round((data.calories / 800) * 100)}% of 800 goal
//           </Text>
//         </View>
//         <View style={[styles.card, { flex: 1 }]}>
//           <Text style={styles.cardLabel}>Sleep</Text>
//           <Text style={styles.cardValue}>
//             {data.sleepHours || '—'} <Text style={styles.cardUnit}>hrs</Text>
//           </Text>
//           {data.sleepHours > 0 && (
//             <ProgressBar value={data.sleepHours} max={8} color="#185FA5" />
//           )}
//           <Text style={styles.cardSub}>Goal: 8 hrs</Text>
//         </View>
//       </View>

//       {/* Heart */}
//       <Text style={styles.sectionTitle}>Heart Rate</Text>
//       <View style={styles.row}>
//         <Pressable
//           style={[styles.card, { flex: 1 }]}
//           onPress={() => {
//             navigation.navigate(HealthRoutes.HEART_RATE);
//           }}
//         >
//           <Text style={styles.cardLabel}>Average BPM</Text>
//           <View style={styles.cardValueRow}>
//             <Text style={styles.cardValueLg}>{data.heartRate || '—'}</Text>
//             {data.heartRate > 0 && <Text style={styles.cardUnit}> bpm</Text>}
//           </View>
//           {hrZone && <Badge {...hrZone} />}
//         </Pressable>
//         <View style={[styles.card, { flex: 1 }]}>
//           <Text style={styles.cardLabel}>Min / Max</Text>
//           <Text style={styles.cardValueLg}>
//             {data.heartRateMin && data.heartRateMax
//               ? `${data.heartRateMin} / ${data.heartRateMax}`
//               : '—'}
//           </Text>
//           {data.heartRateMin > 0 && <Text style={styles.cardSub}>bpm</Text>}
//         </View>
//       </View>

//       {/* Blood Pressure */}
//       <Text style={styles.sectionTitle}>Blood Pressure</Text>
//       <View style={styles.bpCard}>
//         <View style={styles.bpRow}>
//           <Pressable
//             style={[{ flex: 1 }]}
//             onPress={() => {
//               navigation.navigate(HealthRoutes.BLOOD_PRESSURE);
//             }}
//           >
//             <Text style={styles.cardLabel}>Systolic / Diastolic</Text>
//             <View style={styles.cardValueRow}>
//               <Text style={[styles.cardValueLg, { fontSize: 34 }]}>
//                 {data.bloodPressureSystolic || '—'}
//               </Text>
//               {data.bloodPressureSystolic > 0 && (
//                 <>
//                   <Text
//                     style={[styles.cardUnit, { fontSize: 22, color: '#ccc' }]}
//                   >
//                     {' '}
//                     /{' '}
//                   </Text>
//                   <Text style={[styles.cardValueLg, { fontSize: 34 }]}>
//                     {data.bloodPressureDiastolic}
//                   </Text>
//                   <Text style={styles.cardUnit}> mmHg</Text>
//                 </>
//               )}
//             </View>
//           </Pressable>
//           {bpStatus && <Badge {...bpStatus} />}
//         </View>
//         <View style={styles.bpSubRow}>
//           <Text style={styles.cardSub}>Systolic</Text>
//           <Text style={styles.cardSub}>Diastolic</Text>
//         </View>
//       </View>

//       {/* Vitals */}
//       <Text style={styles.sectionTitle}>Vitals</Text>
//       <View style={styles.row}>
//         <MetricCard
//           label="Weight"
//           value={data.weight || '—'}
//           unit={data.weight ? 'kg' : undefined}
//           sub="Last recorded"
//         />
//         <MetricCard
//           label="Blood Glucose"
//           value={data.bloodGlucose || '—'}
//           unit={data.bloodGlucose ? 'mmol/L' : undefined}
//           sub="Last 24 hrs"
//         />
//       </View>
//     </ScrollView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#F5F4F1', paddingHorizontal: 16 },
//   center: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     padding: 32,
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingTop: 20,
//     marginBottom: 4,
//   },
//   title: { fontSize: 22, fontWeight: '600', color: '#1a1a1a' },
//   platformBadge: { fontSize: 12, color: '#888', marginTop: 2 },
//   sectionTitle: {
//     fontSize: 11,
//     fontWeight: '500',
//     color: '#aaa',
//     letterSpacing: 1,
//     textTransform: 'uppercase',
//     marginTop: 20,
//     marginBottom: 10,
//   },
//   row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
//   card: {
//     flex: 1,
//     backgroundColor: '#fff',
//     borderRadius: 14,
//     padding: 14,
//     borderWidth: 0.5,
//     borderColor: 'rgba(0,0,0,0.07)',
//   },
//   cardLabel: { fontSize: 12, color: '#999', marginBottom: 4 },
//   cardValueRow: { flexDirection: 'row', alignItems: 'baseline' },
//   cardValue: { fontSize: 20, fontWeight: '500', color: '#1a1a1a' },
//   cardValueLg: { fontSize: 26, fontWeight: '500', color: '#1a1a1a' },
//   cardUnit: { fontSize: 12, color: '#aaa' },
//   cardSub: { fontSize: 11, color: '#bbb', marginTop: 4 },
//   badge: {
//     alignSelf: 'flex-start',
//     paddingHorizontal: 8,
//     paddingVertical: 3,
//     borderRadius: 6,
//     marginTop: 6,
//   },
//   badgeText: { fontSize: 11, fontWeight: '500' },
//   progressBg: {
//     height: 5,
//     backgroundColor: '#f0f0ee',
//     borderRadius: 3,
//     marginTop: 8,
//   },
//   progressFill: { height: 5, borderRadius: 3 },
//   bpCard: {
//     backgroundColor: '#fff',
//     borderRadius: 14,
//     padding: 16,
//     borderWidth: 0.5,
//     borderColor: 'rgba(0,0,0,0.07)',
//     marginBottom: 10,
//   },
//   bpRow: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'flex-start',
//   },
//   bpSubRow: { flexDirection: 'row', gap: 40, marginTop: 6 },
//   loadingText: { marginTop: 12, fontSize: 14, color: '#888' },
//   errorTitle: {
//     fontSize: 16,
//     fontWeight: '500',
//     color: '#1a1a1a',
//     textAlign: 'center',
//     marginBottom: 16,
//   },
//   btn: {
//     backgroundColor: '#1a1a1a',
//     paddingHorizontal: 24,
//     paddingVertical: 12,
//     borderRadius: 10,
//   },
//   btnText: { color: '#fff', fontWeight: '500', fontSize: 15 },
// });

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  AppText,
  AppView,
  Header,
  Loader,
  Screen,
  Tabs,
} from '../../../components';
import RightTrackerHeader from '../components/tracker/RightTrackerHeader';
import DailyStatsSection, {
  type MetricRow,
} from '../components/tracker/DailyStatsSection';
import NutritionAndGoalSection from '../components/tracker/NutritionAndGoalSection';
import {
  HealthGate,
  resolveHealthGateReason,
  type HealthGateReason,
} from '../components/tracker/HealthGate';
import { useAuthStore } from '../../auth/store/authStore';
import { useHealth } from '../hooks/useHealth';
import { WeeklyStepEntry, type HealthData } from '../types/healthTypes';
import { STEP_GOAL, TabId, TABS } from '../constants/tracker.constant';
import { useWeeklySteps } from '../hooks/useWeeklySteps';
import { useGamification } from '../hooks/useGamification';
import { useStreak } from '../hooks/useStreak';
import { useGamificationStore } from '../store/gamificationStore';
import { buildMetricRows } from '../service/health.service';
import type { StreaksResponseData } from '../types/gamification.type';
import { useSyncHealth } from '../hooks/useSyncHealth';
import { navigate } from '../../../navigation/navigationRef';
import {
  AccountRoutes,
  HealthRoutes,
  RootRoutes,
} from '../../../navigation/routes';

const RIGHT_ACTION = (
  <RightTrackerHeader
    onNotificationPress={() => {
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
        screen: AccountRoutes.NOTIFICATIONS,
      });
    }}
    onActivityPress={() => {
      navigate(RootRoutes.HEALTH_NAVIGATOR, {
        screen: HealthRoutes.ANALYTICS,
      });
    }}
    onProfilePress={() => {
      navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
        screen: AccountRoutes.EDIT_PROFILE,
      });
    }}
    onCoinPress={() => {
      navigate(RootRoutes.HEALTH_NAVIGATOR, {
        screen: HealthRoutes.COINS,
      });
    }}
  />
);

// ─── Tab panels ───────────────────────────────────────────────────────────────

type TabPanelsProps = {
  goal: number;
  activeTab: TabId;
  data: HealthData;
  weekData: WeeklyStepEntry[];
  isWeekPending: boolean;
  metricRows: MetricRow[];
  streakData?: StreaksResponseData | null;
  isStreakPending: boolean;
  streakDays: number;
  syncDailyProgress: (coinsEarnedThisDay: number, metGoal: boolean) => void;
  onUpdate?: () => void;
};

const TabPanels = memo(
  ({
    goal,
    activeTab,
    data,
    weekData,
    isWeekPending,
    metricRows,
    streakData,
    isStreakPending,
    streakDays,
    syncDailyProgress,
    onUpdate,
  }: TabPanelsProps) => (
    <>
      <DailyStatsSection
        hidden={activeTab !== TabId.DailyStats}
        steps={data.steps}
        goal={goal}
        weekData={weekData}
        isWeekPending={isWeekPending}
        todayIndex={new Date().getDay()}
        metricRows={metricRows}
        stats={{
          heartRate: data?.heartRate,
          heartRateMax: data?.heartRateMax,
          heartRateMin: data?.heartRateMin,
          bloodPressureDiastolic: data?.bloodPressureDiastolic,
          bloodPressureSystolic: data?.bloodPressureSystolic,
          hydration: data?.hydration,
        }}
        streakData={streakData}
        isStreakPending={isStreakPending}
        streakDays={streakDays}
        syncDailyProgress={syncDailyProgress}
        onUpdate={onUpdate}
      />
      <NutritionAndGoalSection hidden={activeTab !== TabId.NutritionGoal} />
    </>
  ),
  (prev, next) =>
    prev.activeTab === next.activeTab &&
    prev.data === next.data &&
    prev.weekData === next.weekData &&
    prev.metricRows === next.metricRows &&
    prev.onUpdate === next.onUpdate,
);

TabPanels.displayName = 'TabPanels';

// ─── Screen ───────────────────────────────────────────────────────────────────

const TrackerScreen = memo(() => {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.DailyStats);
  const [gateReason, setGateReason] = useState<HealthGateReason | null>(null);

  const weightKg = useAuthStore(state => state.user?.weight);
  const dailyStepGoal = useAuthStore(state => state.user?.dailyStepGoal);

  const { platform, isReady, isLoading, data, error, refresh, lastUpdated } =
    useHealth({ weightKg: Number(weightKg) });

  const {
    data: weekData,
    mutate: refreshWeek,
    isPending: isWeekPending,
  } = useWeeklySteps();

  // Gamification & Streaks
  const { mutate: fetchGamification } = useGamification();
  const {
    streakData,
    mutate: fetchStreakData,
    isPending: isStreakPending,
  } = useStreak();
  const streakDays = useGamificationStore(s => s.streakDays);
  const syncDailyProgress = useGamificationStore(s => s.syncDailyProgress);

  useEffect(() => {
    fetchGamification(); // load real coin balance from server on mount
    fetchStreakData();
  }, [fetchGamification, fetchStreakData]);

  const { syncHealth } = useSyncHealth();

  useEffect(() => {
    // Automatically push health data to server when loaded
    if (isReady && data && lastUpdated) {
      const isGoalMet = data.steps >= (dailyStepGoal || 8000);
      syncHealth({
        ...data,
        goalMet: isGoalMet,
      });
    }
  }, [data, isReady, lastUpdated, dailyStepGoal, syncHealth]);

  // ── Gate reason ────────────────────────────────────────────────────────────

  useEffect(() => {
    setGateReason(resolveHealthGateReason({ platform, isReady, error }));
  }, [platform, isReady, error]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const metricRows = useMemo(() => buildMetricRows(data), [data]);

  const subtitle = useMemo(() => {
    if (!lastUpdated) return 'Today';
    const h = lastUpdated.getHours().toString().padStart(2, '0');
    const m = lastUpdated.getMinutes().toString().padStart(2, '0');
    return `Updated ${h}:${m}`;
  }, [lastUpdated]);

  // ── Background Sync ───────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      // Silently sync health databases every time the user looks at the tracker
      refresh(true);
    }, [refresh]),
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTabPress = useCallback((value: number) => {
    setActiveTab(value as TabId);
  }, []);

  const handleGateDismiss = useCallback(() => setGateReason(null), []);

  const handleRefresh = useCallback(() => {
    refresh();
    refreshWeek();
    fetchStreakData();
    fetchGamification();
  }, [refresh, refreshWeek, fetchStreakData, fetchGamification]);

  const handleGateRetry = useCallback(() => {
    setGateReason(null);
    handleRefresh();
  }, [handleRefresh]);

  // ── Header ────────────────────────────────────────────────────────────────

  const header = useMemo(
    () => (
      <Header
        title="My Health"
        subtitle={subtitle}
        bordered
        rightAction={RIGHT_ACTION}
      />
    ),
    [subtitle],
  );

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading && !isReady) {
    return (
      <Loader message="Connecting to health data…" size="large" fullscreen />
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Screen
        safeArea={false}
        scroll
        header={header}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor="#1a1a1a"
          />
        }
      >
        <Tabs tabs={TABS} activeTab={activeTab} onPress={handleTabPress} />
        <TabPanels
          goal={dailyStepGoal || 8000}
          activeTab={activeTab}
          data={data}
          weekData={weekData?.data || []}
          isWeekPending={isWeekPending}
          metricRows={metricRows}
          streakData={streakData}
          isStreakPending={isStreakPending}
          streakDays={streakDays}
          syncDailyProgress={syncDailyProgress}
          onUpdate={() => refresh(true)}
        />
      </Screen>

      <HealthGate
        reason={gateReason}
        errorMessage={error ?? undefined}
        onRetry={handleGateRetry}
        onDismiss={handleGateDismiss}
      />
    </>
  );
});

TrackerScreen.displayName = 'TrackerScreen';

export default TrackerScreen;

const styles = StyleSheet.create({});
