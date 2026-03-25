// ─── HydrationScreen ──────────────────────────────────────────────────────────

import React, { useState } from 'react';
import { StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';

import { useHydration } from '../hooks/useHydration';
import { StatsCard } from '../components/hydration/StatsCard';
import { AmountDisplay } from '../components/hydration/AmountDisplay';
import { WaterGlass } from '../components/hydration/WaterGlass';
import { QuickAddButtons } from '../components/hydration/QuickAddButtons';
import { HistoryList } from '../components/hydration/HistoryList';
import { ScheduleModal } from '../components/hydration/ScheduleModal';
import { useHydrationScheduleStore } from '../store/hydrationScheduleStore';

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
  const [scheduleVisible, setScheduleVisible] = useState(false);
  const scheduledCount = useHydrationScheduleStore(
    s => s.scheduledTimes.length,
  );
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
                <AppView style={styles.badge}>
                  <AppText style={styles.badgeText}>{scheduledCount}</AppText>
                </AppView>
              )}
            </TouchableOpacity>
          }
        />
      }
    >
      <StatusBar barStyle="light-content" />

      {/* Background layers */}
      <View style={styles.bgLayer1} />
      <View style={styles.bgLayer2} />

      {/* Status / sync message */}
      <View style={styles.headerRow}>
        <AppText style={styles.statusMsg}>{statusMessage}</AppText>
        {isSyncing && (
          <AppText style={styles.syncingText}>↻ Syncing health data…</AppText>
        )}
        {error && <AppText style={styles.errorText}>⚠ {error}</AppText>}
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

      {/* Quick add + reset */}
      <QuickAddButtons onAdd={addWater} onReset={resetDay} />

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

const styles = StyleSheet.create({
  bgLayer1: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#020c18',
  },
  bgLayer2: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(14,165,233,0.06)',
  },
  headerRow: {
    marginBottom: 16,
    gap: 4,
  },
  statusMsg: {
    color: '#38bdf8',
    marginTop: 16,
    fontWeight: '500',
  },
  syncingText: {
    fontSize: 11,
    color: '#475569',
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 12,
    color: '#f87171',
  },
  glassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bellBtn: {
    padding: 6,
    position: 'relative',
  },
  bellIcon: {
    fontSize: 22,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#0ea5e9',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
