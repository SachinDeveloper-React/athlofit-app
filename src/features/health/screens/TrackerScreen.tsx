import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Header, Loader, Screen, Tabs } from '../../../components';
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
import { TabId, TABS } from '../constants/tracker.constant';
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

const RIGHTACTION = memo(
  ({
    userName,
    userAvatarUrl,
  }: {
    userName: string;
    userAvatarUrl: string;
  }) => (
    <RightTrackerHeader
      avatarUri={userAvatarUrl}
      avatarName={userName}
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
  ),
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

  const userAvatarUrl = useAuthStore(state => state.user?.avatarUrl);
  const userName = useAuthStore(state => state.user?.name);
  const weightKg = useAuthStore(state => state.user?.weight);
  const dailyStepGoal = useAuthStore(state => state.user?.dailyStepGoal);

  const { platform, isReady, isLoading, data, error, refresh, lastUpdated } =
    useHealth({ weightKg: Number(weightKg) || 70 });

  const {
    data: weekData,
    refetch: refreshWeek,
    isLoading: isWeekPending,
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
        rightAction={
          <RIGHTACTION
            userName={userName ?? ''}
            userAvatarUrl={userAvatarUrl ?? ''}
          />
        }
      />
    ),
    [subtitle, userName, userAvatarUrl],
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
          weekData={weekData || []}
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
