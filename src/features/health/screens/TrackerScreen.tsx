import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
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
import PermissionDeniedScreen, {
  type PermissionScenario,
} from '../components/tracker/PermissionDeniedScreen';
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
import { useWidgetSync } from '../../../hooks/useWidgetSync';
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
        todayIndex={(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"] as const)[(new Date().getDay() + 6) % 7]}
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
    prev.streakData === next.streakData &&
    prev.streakDays === next.streakDays &&
    prev.isStreakPending === next.isStreakPending &&
    prev.syncDailyProgress === next.syncDailyProgress &&
    prev.onUpdate === next.onUpdate,
);

TabPanels.displayName = 'TabPanels';

// ─── Screen ───────────────────────────────────────────────────────────────────

/**
 * Maps the health platform state to a PermissionScenario for the inline
 * PermissionDeniedScreen, or null if no permission issue exists.
 */
function resolvePermissionScenario(
  platform: string,
  isReady: boolean,
  error: string | null,
): PermissionScenario | null {
  if (platform === 'unavailable') {
    const lower = error?.toLowerCase() ?? '';
    // Health Connect not installed
    if (lower.includes('health connect') || lower.includes('not installed')) {
      return 'android-missing';
    }
    // Permission denied on Android
    if (lower.includes('denied') || lower.includes('permission')) {
      return 'android-denied';
    }
    // iOS HealthKit denied
    if (lower.includes('healthkit') || lower.includes('health access')) {
      return 'ios-denied';
    }
    // Generic unavailable — treat as android-denied (most common)
    return 'android-denied';
  }

  if (!isReady && platform === 'healthkit') {
    const lower = error?.toLowerCase() ?? '';
    if (lower.includes('denied') || lower.includes('permission')) {
      return 'ios-denied';
    }
  }

  return null;
}

const TrackerScreen = memo(() => {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.DailyStats);
  const [gateReason, setGateReason] = useState<HealthGateReason | null>(null);
  // ── Track whether the current load was triggered by the user pulling down ──
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const userAvatarUrl = useAuthStore(state => state.user?.avatarUrl);
  const userName = useAuthStore(state => state.user?.name);
  const weightKg = useAuthStore(state => state.user?.weight);
  const dailyStepGoal = useAuthStore(state => state.user?.dailyStepGoal);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userId = useAuthStore(state => state.user?._id);

  const { platform, isReady, isLoading, data, error, refresh, lastUpdated } =
    useHealth({ weightKg: Number(weightKg) || 70 });

  const {
    data: weekData,
    refetch: refreshWeek,
    isLoading: isWeekPending,
  } = useWeeklySteps();

  // Gamification & Streaks
  const { refetch: fetchGamification } = useGamification();
  const {
    streakData,
    isPending: isStreakPending,
    refetch: refetchStreak,
  } = useStreak();
  const streakDays = useGamificationStore(s => s.streakDays);
  const syncDailyProgress = useGamificationStore(s => s.syncDailyProgress);

  // No manual fetchGamification on mount — useQuery handles it automatically

  const { syncHealth } = useSyncHealth();

  // ── Unified initial loading ────────────────────────────────────────────────
  // Show a single full-screen loader until all parallel data sources have
  // resolved at least once. After that, individual sections handle their own
  // in-place loading states so the screen never goes blank on refresh.
  const isInitialLoad =
    (isLoading && !isReady) ||
    (isWeekPending && !weekData) ||
    (isStreakPending && !streakData);

  // Track the last synced user ID to detect account switches
  const lastSyncedUserRef = useRef<string | null>(null);
  // Throttle: track last sync time and last synced step count
  const lastSyncTimeRef = useRef<number>(0);
  const lastSyncedStepsRef = useRef<number>(-1);
  const MIN_SYNC_INTERVAL_MS = 5 * 60_000; // 5 minutes between syncs
  const MIN_STEP_DELTA = 10; // only re-sync if steps changed by at least 10

  // Sync widget with current steps and goal
  useWidgetSync({
    steps: data.steps,
    goal: dailyStepGoal || 10000,
    enabled: isAuthenticated && isReady,
  });

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    // Detect account switch
    if (lastSyncedUserRef.current && lastSyncedUserRef.current !== userId) {
      lastSyncedUserRef.current = userId;
      lastSyncedStepsRef.current = -1;
      lastSyncTimeRef.current = 0;
      refresh(true);
      return;
    }

    if (!isReady || !data || !lastUpdated) return;

    const now = Date.now();
    const timeSinceLastSync = now - lastSyncTimeRef.current;
    const stepDelta = Math.abs(data.steps - lastSyncedStepsRef.current);

    // Skip sync if: not enough time has passed AND steps haven't changed meaningfully
    if (
      lastSyncedStepsRef.current !== -1 && // not first sync
      timeSinceLastSync < MIN_SYNC_INTERVAL_MS &&
      stepDelta < MIN_STEP_DELTA
    ) {
      return;
    }

    const isGoalMet = data.steps >= (dailyStepGoal || 8000);
    syncHealth({ ...data, goalMet: isGoalMet });
    lastSyncedUserRef.current = userId;
    lastSyncTimeRef.current = now;
    lastSyncedStepsRef.current = data.steps;
  }, [data, isReady, lastUpdated, dailyStepGoal, syncHealth, isAuthenticated, userId, refresh]);

  // ── Gate reason ────────────────────────────────────────────────────────────

  useEffect(() => {
    setGateReason(resolveHealthGateReason({ platform, isReady, error }));
  }, [platform, isReady, error]);

  // ── Permission scenario (inline screen) ───────────────────────────────────
  const permissionScenario = useMemo(
    () => resolvePermissionScenario(platform, isReady, error),
    [platform, isReady, error],
  );

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
      // On every focus: silently refresh health data from device AND
      // re-fetch weekly steps from the server so the chart is always current.
      refresh(true);
      refreshWeek();
    }, [refresh, refreshWeek]),
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTabPress = useCallback((value: number) => {
    setActiveTab(value as TabId);
  }, []);

  const handleGateDismiss = useCallback(() => setGateReason(null), []);

  const handleRefresh = useCallback(() => {
    // Mark this as a user-initiated pull-to-refresh so the spinner shows
    setIsManualRefreshing(true);
    refresh();
    refreshWeek();
    fetchGamification();
    // streak refetch is handled by useStreaks/useStreak via React Query's
    // refetchOnWindowFocus and the manual refetch below
    refetchStreak();
  }, [refresh, refreshWeek, fetchGamification, refetchStreak]);

  const handleGateRetry = useCallback(() => {
    setGateReason(null);
    handleRefresh();
  }, [handleRefresh]);

  // ── Clear manual refresh flag once all data has finished loading ──────────
  // isLoading goes false when health data finishes; isWeekPending and
  // isStreakPending cover the API queries. Only clear when ALL are done.
  useEffect(() => {
    if (isManualRefreshing && !isLoading && !isWeekPending && !isStreakPending) {
      setIsManualRefreshing(false);
    }
  }, [isManualRefreshing, isLoading, isWeekPending, isStreakPending]);

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

  if (isInitialLoad) {
    return (
      <Loader message="Connecting to health data…" size="large" fullscreen />
    );
  }

  // ── Permission denied — show full inline screen ───────────────────────────

  if (permissionScenario) {
    return (
      <Screen safeArea={false} scroll={false} header={header}>
        <PermissionDeniedScreen
          scenario={permissionScenario}
          errorMessage={error ?? undefined}
          onPermissionGranted={() => {
            setGateReason(null);
            handleRefresh();
          }}
        />
      </Screen>
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
            refreshing={isManualRefreshing}
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
