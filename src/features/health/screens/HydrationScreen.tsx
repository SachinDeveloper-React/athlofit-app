// ─── HydrationScreen ──────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { withOpacity } from '../../../utils/withOpacity';

import { useHydration } from '../hooks/useHydration';
import { useCoinData } from '../hooks/useGamification';
import { StatsCard } from '../components/hydration/StatsCard';
import { AmountDisplay } from '../components/hydration/AmountDisplay';
import { WaterGlass } from '../components/hydration/WaterGlass';
import { QuickAddButtons } from '../components/hydration/QuickAddButtons';
import { HistoryList } from '../components/hydration/HistoryList';
import { ScheduleModal } from '../components/hydration/ScheduleModal';
import { useHydrationScheduleStore } from '../store/hydrationScheduleStore';
import { makeStyles } from '../../../hooks/makeStyles';
import { navigate } from '../../../navigation/navigationRef';
import { useNetworkStore } from '../../../store/networkStore';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  bgLayer2: {
    position: 'absolute' as const,
    top: -100,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  headerRow: {
    marginBottom: spacing[4],
    gap: spacing[1],
  },
  statusMsg: {
    marginTop: spacing[4],
    fontWeight: fontWeight.medium,
  },
  syncingText: {
    fontSize: fontSize.xs,
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: fontSize.sm,
  },
  glassRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-around' as const,
  },
  bellBtn: {
    padding: spacing[1.5],
    position: 'relative' as const,
  },
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    borderRadius: radius.md,
    minWidth: 16,
    height: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
}));

type Props = {};

const HydrationScreen = (_props: Props) => {
  const {
    consumed,
    dailyGoal,
    history,
    percentage,
    remaining,
    statusMessage,
    isLoading,
    isSyncing,
    error,
    addWater,
    resetDay,
  } = useHydration();
  const { colors } = useTheme();
  const styles = useStyles();
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const scheduledCount = useHydrationScheduleStore(
    s => s.scheduledTimes.length,
  );
  const isOnline = useNetworkStore(state => state.isOnline);

  // Check if user has earned coins from hydration (for reset warning)
  const { data: coinData } = useCoinData();
  const hydrationReward = coinData?.claimable?.find(c => c.id === 'hydration_daily');
  const hasEarnedHydrationCoins = hydrationReward?.isClaimed === true;

  // Wrap resetDay with a confirmation alert when coins were earned
  const handleReset = useCallback(() => {
    if (hasEarnedHydrationCoins) {
      Alert.alert(
        'Reset Water Intake?',
        'You earned coins from hydration today. If you reset, those coins (including challenge rewards) will be deducted from your balance.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset Anyway', style: 'destructive', onPress: resetDay },
        ],
      );
    } else if (consumed >= dailyGoal) {
      // Goal met but not yet claimed — still warn about challenge reversion
      Alert.alert(
        'Reset Water Intake?',
        'Your hydration challenges will be reverted. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Reset', style: 'destructive', onPress: resetDay },
        ],
      );
    } else {
      resetDay();
    }
  }, [hasEarnedHydrationCoins, consumed, dailyGoal, resetDay]);

  const handleEditGoal = useCallback(() => {
    navigate('HealthStack', { screen: 'EditHydrationGoalScreen' });
  }, []);
  return (
    <Screen
      scroll
      safeArea={false}
      header={
        <Header
          title="Water Tracker"
          bordered
          showBack
          backLabel=""
          rightAction={
            <TouchableOpacity
              onPress={() => setScheduleVisible(true)}
              style={styles.bellBtn}
              activeOpacity={0.75}
            >
              <AppText style={styles.bellIcon}>🔔</AppText>
              {scheduledCount > 0 && (
                <AppView
                  style={[
                    styles.badge,
                    { backgroundColor: colors.destructive },
                  ]}
                >
                  <AppText style={styles.badgeText}>{scheduledCount}</AppText>
                </AppView>
              )}
            </TouchableOpacity>
          }
        />
      }
    >
      {/* Background layers */}
      <View
        style={[
          styles.bgLayer2,
          { backgroundColor: withOpacity(colors.primary, 0.06) },
        ]}
      />

      {/* Status / sync message */}
      <View style={styles.headerRow}>
        <AppText style={[styles.statusMsg, { color: colors.primary }]}>
          {statusMessage}
        </AppText>
        {isSyncing && isOnline && (
          <AppText
            style={[styles.syncingText, { color: colors.mutedForeground }]}
          >
            ↻ Syncing health data…
          </AppText>
        )}
        {error && isOnline && (
          <AppText style={[styles.errorText, { color: colors.destructive }]}>
            ⚠ {error}
          </AppText>
        )}
      </View>

      {/* Stats card with glass + amount */}
      <StatsCard
        consumed={consumed}
        dailyGoal={dailyGoal}
        remaining={remaining}
        percentage={percentage}
      >
        <View style={styles.glassRow}>
          <WaterGlass percentage={percentage} dailyGoal={dailyGoal} />
          <AmountDisplay
            consumed={consumed}
            dailyGoal={dailyGoal}
            percentage={percentage}
          />
        </View>
      </StatsCard>

      {/* Edit goal */}
      <TouchableOpacity onPress={handleEditGoal} activeOpacity={0.7}>
        <AppText
          variant="caption1"
          style={{ color: colors.primary, textAlign: 'center', marginTop: 8, fontWeight: '600' }}
        >
          ✏️ Edit Daily Goal ({dailyGoal}ml)
        </AppText>
      </TouchableOpacity>

      {/* Quick add + reset */}
      <QuickAddButtons onAdd={addWater} onReset={handleReset} />

      {/* History list from backend */}
      <HistoryList history={history} isLoading={isLoading} />

      <ScheduleModal
        visible={scheduleVisible}
        onClose={() => setScheduleVisible(false)}
      />
    </Screen>
  );
};

export default HydrationScreen;
