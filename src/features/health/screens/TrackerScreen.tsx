import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Platform, RefreshControl, ScrollView, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppView, Header, Loader, Screen, Tabs } from '../../../components';
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
import SkeletonPlaceholder from '../components/tracker/SkeletonPlaceholder';
import { useAuthStore } from '../../auth/store/authStore';
import { useHealth } from '../hooks/useHealth';
import { WeeklyStepEntry, type HealthData, defaultHealthData } from '../types/healthTypes';
import { TabId, TABS } from '../constants/tracker.constant';
import { useWeeklySteps } from '../hooks/useWeeklySteps';
import { useGamification } from '../hooks/useGamification';
import { useStreak } from '../hooks/useStreak';
import { useGamificationStore } from '../store/gamificationStore';
import { useHealthDataStore } from '../store/healthDataStore';
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
import { useNetworkStore } from '../../../store/networkStore';
import { Spacing } from '../../../constants/spacing';

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
  isWeekSkeleton: boolean;
  metricRows: MetricRow[];
  streakData?: StreaksResponseData | null;
  isStreakPending: boolean;
  isStreakSkeleton: boolean;
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
    isWeekSkeleton,
    metricRows,
    streakData,
    isStreakPending,
    isStreakSkeleton,
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
        todayIndex={(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const)[(new Date().getDay() + 6) % 7]}
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
      {/* Skeleton for weekly chart section when loading without data */}
      {isWeekSkeleton && activeTab === TabId.DailyStats && (
        <View style={skeletonStyles.weeklyChartSkeleton}>
          <SkeletonPlaceholder width="100%" height={160} borderRadius={12} />
        </View>
      )}
      {/* Skeleton for streaks section when loading without data */}
      {isStreakSkeleton && activeTab === TabId.DailyStats && (
        <View style={skeletonStyles.streaksSkeleton}>
          <SkeletonPlaceholder width="100%" height={80} borderRadius={12} />
        </View>
      )}
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
    prev.isWeekSkeleton === next.isWeekSkeleton &&
    prev.isStreakSkeleton === next.isStreakSkeleton &&
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
  const isOnline = useNetworkStore(state => state.isOnline);

  const userAvatarUrl = useAuthStore(state => state.user?.avatarUrl);
  const userName = useAuthStore(state => state.user?.name);
  const weightKg = useAuthStore(state => state.user?.weight);
  const dailyStepGoal = useAuthStore(state => state.user?.dailyStepGoal);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userId = useAuthStore(state => state.user?._id);

  const { platform, isReady, isLoading, data, error, refresh, retrySetup, lastUpdated } =
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
  // Only show a full-screen loader if there is NO cached data at all.
  // If cached data exists (from MMKV persistence), render the screen
  // immediately with cached values and show skeleton placeholders for
  // sections that are still loading.
  const cachedData = useHealthDataStore.getState().data;
  const hasCachedData =
    cachedData != null &&
    JSON.stringify(cachedData) !== JSON.stringify(defaultHealthData);

  const isInitialLoad =
    !hasCachedData &&
    ((isLoading && !isReady) ||
      (isWeekPending && !weekData) ||
      (isStreakPending && !streakData));

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
  // Don't show PermissionDeniedScreen while setup is still in progress —
  // platform starts as 'unavailable' and flips to the real value once setup()
  // finishes. Showing the permission screen during that window is a false
  // positive (Bug: permission screen flashes on every app open).
  const permissionScenario = useMemo(
    () => isLoading ? null : resolvePermissionScenario(platform, isReady, error),
    [platform, isReady, error, isLoading],
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
      // On focus: check staleness before refreshing to deduplicate rapid
      // focus events (e.g., tab switches within 5s).
      const lastFetchedAt = useHealthDataStore.getState().lastFetchedAt;
      const isFresh = lastFetchedAt != null && Date.now() - lastFetchedAt < 5_000;

      if (!isFresh) {
        // Data is stale or never fetched — silently refresh
        refresh(true);
        refreshWeek();
      }
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

  if (isInitialLoad && isOnline) {
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
            retrySetup();
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
        // scroll
        padded={false}
        header={header}
        refreshControl={
          <RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor="#1a1a1a"
          />
        }
      >
        <ScrollView

          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={true}
          contentInset={{ bottom: 100 }}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom:
              Platform.OS === 'android'
                ? 100 + 16
                : 100,
          }}
          refreshControl={<RefreshControl
            refreshing={isManualRefreshing}
            onRefresh={handleRefresh}
            tintColor="#1a1a1a"
          />}


        >
          <AppView style={{flex:1, paddingHorizontal: Spacing[4]}}>
          <Tabs tabs={TABS} activeTab={activeTab} onPress={handleTabPress} />
          <TabPanels
            goal={dailyStepGoal || 8000}
            activeTab={activeTab}
            data={data}
            weekData={weekData || []}
            isWeekPending={isWeekPending}
            isWeekSkeleton={isWeekPending && !weekData}
            metricRows={metricRows}
            streakData={streakData}
            isStreakPending={isStreakPending}
            isStreakSkeleton={isStreakPending && !streakData}
            streakDays={streakDays}
            syncDailyProgress={syncDailyProgress}
            onUpdate={() => refresh(true)}
          />
          </AppView>
        </ScrollView>
      </Screen>

      <HealthGate
        reason={isOnline ? gateReason : null}
        errorMessage={error ?? undefined}
        onRetry={handleGateRetry}
        onDismiss={handleGateDismiss}
      />
    </>
  );
});

TrackerScreen.displayName = 'TrackerScreen';

const skeletonStyles = StyleSheet.create({
  weeklyChartSkeleton: {
    marginTop: 16,
    marginBottom: 12,
  },
  streaksSkeleton: {
    marginTop: 12,
    marginBottom: 12,
  },
});

export default TrackerScreen;
