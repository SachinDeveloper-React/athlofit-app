import React, { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Platform, RefreshControl, ScrollView, View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
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
import { toISODate } from '../utils/healthFormatters';
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
import { getLocalToday } from '../../../utils/date';
import { Spacing } from '../../../constants/spacing';
import { nutritionKeys } from '../hooks/useNutrition';
import CoinBlockedBanner from '../components/tracker/CoinBlockedBanner';
import ActivityPermissionBanner from '../components/tracker/ActivityPermissionBanner';
import BatteryOptimizationBanner from '../../../components/BatteryOptimizationBanner';

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
        todayIndex={toISODate(new Date())}
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
    // iOS — always resolve to 'ios-denied' when unavailable
    if (Platform.OS === 'ios') {
      return 'ios-denied';
    }

    const lower = error?.toLowerCase() ?? '';
    // Health Connect not installed
    if (lower.includes('health connect') || lower.includes('not installed')) {
      return 'android-missing';
    }
    // Permission denied on Android
    return 'android-denied';
  }

  // HealthKit initialized but not ready (permission denied mid-session)
  if (!isReady && platform === 'healthkit') {
    return 'ios-denied';
  }

  return null;
}

const TrackerScreen = memo(() => {
  const [activeTab, setActiveTab] = useState<TabId>(TabId.DailyStats);
  const [gateReason, setGateReason] = useState<HealthGateReason | null>(null);
  // ── Track whether the current load was triggered by the user pulling down ──
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isOnline = useNetworkStore(state => state.isOnline);
  const queryClient = useQueryClient();

  const userAvatarUrl = useAuthStore(state => state.user?.avatarUrl);
  const userName = useAuthStore(state => state.user?.name);
  const weightKg = useAuthStore(state => state.user?.weight);
  const userGender = useAuthStore(state => state.user?.gender);
  const dailyStepGoal = useAuthStore(state => state.user?.dailyStepGoal);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const userId = useAuthStore(state => state.user?._id);

  const { platform, isReady, isLoading, data, error, refresh, retrySetup, skipToNativeSensor, lastUpdated } =
    useHealth({ weightKg: Number(weightKg) || 70, gender: userGender });

  // Bonus steps credited by admin/system. `data.steps` from useHealth is always
  // DEVICE steps with bonus excluded, so bonus is added here for display and the
  // raw device value is what gets synced — one addition, in one place.
  //
  // The date comparison uses getLocalToday(), not toISOString(). toISOString()
  // returns the UTC date, so for a user in IST every day between midnight and
  // 05:30 local it reported yesterday, and the bonus silently vanished from the
  // total for those five and a half hours while the rest of the pipeline (which
  // already used local dates) still counted it.
  const bonusSteps = useHealthDataStore(s => {
    const today = getLocalToday();
    return s.bonusStepsDate === today ? s.bonusSteps : 0;
  });
  const totalSteps = data.steps + bonusSteps;

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
  const MIN_SYNC_INTERVAL_MS = 20_000; // 20 seconds between backend syncs
  const MIN_STEP_DELTA = 10; // only re-sync if steps changed by at least 10

  // Sync widget with current steps and goal
  useWidgetSync({
    steps: totalSteps,
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

    const isGoalMet = totalSteps >= (dailyStepGoal || 8000);
    // `data.steps` is already device-only — the step engine strips bonus out of
    // the server baseline before using it, so nothing needs subtracting here. The
    // old `data.steps - bonusSteps` was compensating for bonus being baked into
    // data.steps upstream; with that fixed, subtracting again would under-report
    // by the bonus amount every sync.
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

  // When total steps (from server floor) exceed device-reported steps,
  // re-derive distance/calories/activeMinutes so all metrics are consistent.
  const displayData = useMemo(() => {
    if (totalSteps <= data.steps) return { ...data, steps: totalSteps };
    // totalSteps is higher (from store) — re-derive metrics
    const { deriveFromSteps } = require('../service/healthConnect.service');
    const derived = deriveFromSteps(totalSteps, Number(weightKg) || 70, userGender);
    return {
      ...data,
      steps: totalSteps,
      calories: Math.max(data.calories, derived.calories),
      distance: Math.max(data.distance, derived.distanceKm),
      activeMinutes: Math.max(data.activeMinutes, derived.activeMinutes),
    };
  }, [data, totalSteps, weightKg, userGender]);

  const metricRows = useMemo(() => buildMetricRows(displayData), [displayData]);

  // Override today's entry in weekly chart with live local step count.
  // Use the higher of server value and local total — the server may have
  // bonus steps (admin-credited) that the device doesn't know about yet,
  // or the device may have steps not yet synced to the server.
  const adjustedWeekData = useMemo(() => {
    if (!weekData || weekData.length === 0) return weekData;
    const todayDate = new Date();
    const todayISO = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
    return weekData.map(entry =>
      entry.fullDate === todayISO ? { ...entry, steps: Math.max(entry.steps, totalSteps) } : entry,
    );
  }, [weekData, totalSteps]);

  const subtitle = useMemo(() => {
    if (!lastUpdated) return 'Today';
    const h = lastUpdated.getHours().toString().padStart(2, '0');
    const m = lastUpdated.getMinutes().toString().padStart(2, '0');
    return `Updated ${h}:${m}`;
  }, [lastUpdated]);

  // ── Background Sync ───────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      // Always force-refresh on screen focus so the user sees live steps
      // immediately — not cached/stale data from 5+ seconds ago.
      refresh(false);
      refreshWeek();
      // Invalidate nutrition data on focus so preferences/goals updated
      // on another screen (e.g. settings) are reflected immediately.
      const today = new Date().toISOString().split('T')[0];
      queryClient.invalidateQueries({ queryKey: nutritionKeys.preferences() });
      queryClient.invalidateQueries({ queryKey: nutritionKeys.summary(today) });
      queryClient.invalidateQueries({ queryKey: nutritionKeys.options() });
    }, [refresh, refreshWeek, queryClient]),
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
    // Refresh nutrition preferences and daily summary so goals/prefs update
    const today = new Date().toISOString().split('T')[0];
    queryClient.invalidateQueries({ queryKey: nutritionKeys.preferences() });
    queryClient.invalidateQueries({ queryKey: nutritionKeys.summary(today) });
    queryClient.invalidateQueries({ queryKey: nutritionKeys.options() });
  }, [refresh, refreshWeek, fetchGamification, refetchStreak, queryClient]);

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
          onSkip={skipToNativeSensor}
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
          <CoinBlockedBanner />
          <ActivityPermissionBanner platform={platform} isReady={isReady} />
          <BatteryOptimizationBanner />
          <Tabs tabs={TABS} activeTab={activeTab} onPress={handleTabPress} />
          <TabPanels
            goal={dailyStepGoal || 8000}
            activeTab={activeTab}
            data={displayData}
            weekData={adjustedWeekData || []}
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
