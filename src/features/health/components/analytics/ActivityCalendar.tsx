// src/features/health/components/analytics/ActivityCalendar.tsx
import React, { memo, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useCalendarActivity } from '../../hooks/useCalendarActivity';
import { navigate } from '../../../../navigation/navigationRef';
import { HealthRoutes, RootRoutes } from '../../../../navigation/routes';
import type { CalendarDay } from '../../types/calendar.types';

import {
  CalendarGrid,
  CalendarLegend,
  CalendarStatsRow,
  MonthPicker,
} from './calendar';

// ─── Layout constant ──────────────────────────────────────────────────────────
const CARD_PADDING = 16;

// ─── Component ────────────────────────────────────────────────────────────────

const ActivityCalendar = memo(() => {
  const { colors, isDark } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const { data, isLoading, year, month, selectMonth } = useCalendarActivity();

  // ── Cell size: fills card width exactly across all screen sizes ───────────
  const cellSize = useMemo(() => {
    const available = screenWidth - CARD_PADDING * 2 - 32;
    const gapTotal  = 6 * 4;
    return Math.floor((available - gapTotal) / 7);
  }, [screenWidth]);

  // ── Month navigation guards ───────────────────────────────────────────────
  const canGoNext = useMemo(() => {
    const now = new Date();
    return !(year === now.getFullYear() && month === now.getMonth() + 1);
  }, [year, month]);

  const canGoPrev = useMemo(() => {
    if (!data?.availableMonths?.length) return false;
    const first = data.availableMonths[0];
    return !(year === first.year && month === first.month);
  }, [data, year, month]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    selectMonth(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
  }, [canGoNext, year, month, selectMonth]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    selectMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  }, [canGoPrev, year, month, selectMonth]);

  // ── Build week rows for the grid ──────────────────────────────────────────
  const weeks = useMemo(() => {
    if (!data?.days) return [];
    const firstDate = new Date(
      `${data.year}-${String(data.month).padStart(2, '0')}-01T00:00:00`,
    );
    const startDow = firstDate.getDay();
    const padded: (CalendarDay | null)[] = [
      ...Array(startDow).fill(null),
      ...data.days,
    ];
    const rows: (CalendarDay | null)[][] = [];
    for (let i = 0; i < padded.length; i += 7) {
      rows.push(padded.slice(i, i + 7));
    }
    return rows;
  }, [data]);

  // ── Tap a day → navigate to StepDetailScreen ─────────────────────────────
  const handleDayPress = useCallback((day: CalendarDay) => {
    navigate(RootRoutes.HEALTH_NAVIGATOR, {
      screen: HealthRoutes.STEP_DETAIL,
      params: { date: day.date },
    });
  }, []);

  const monthLabel = useMemo(
    () => new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    [year, month],
  );

  return (
    <Animated.View entering={FadeInDown.delay(200).duration(400)}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

        {/* ── Card header ── */}
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
            <CalendarDays size={18} color={colors.primary} />
          </View>
          <AppText
            variant="headline"
            weight="semiBold"
            style={{ color: colors.foreground, flex: 1, marginLeft: 10 }}
          >
            Activity Calendar
          </AppText>
        </View>

        {/* ── Month picker chips (full-bleed) ── */}
        {data?.availableMonths && data.availableMonths.length > 0 && (
          <View style={styles.monthPickerOuter}>
            <MonthPicker
              months={data.availableMonths}
              selectedYear={year}
              selectedMonth={month}
              onSelect={(y, m) => { selectMonth(y, m); }}
              colors={colors}
            />
          </View>
        )}

        {/* ── Month navigation ── */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={!canGoPrev}
            style={[styles.navBtn, { backgroundColor: withOpacity(colors.primary, 0.08), opacity: canGoPrev ? 1 : 0.3 }]}
            activeOpacity={0.7}
          >
            <ChevronLeft size={16} color={colors.primary} />
          </TouchableOpacity>

          <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
            {monthLabel}
          </AppText>

          <TouchableOpacity
            onPress={goNext}
            disabled={!canGoNext}
            style={[styles.navBtn, { backgroundColor: withOpacity(colors.primary, 0.08), opacity: canGoNext ? 1 : 0.3 }]}
            activeOpacity={0.7}
          >
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Stats summary ── */}
        {data && !isLoading && (
          <CalendarStatsRow data={data} colors={colors} />
        )}

        {/* ── Loading ── */}
        {isLoading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primary} />
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 8 }}>
              Loading calendar…
            </AppText>
          </View>
        )}

        {/* ── Grid + legend ── */}
        {!isLoading && data && (
          <>
            <CalendarGrid
              weeks={weeks}
              cellSize={cellSize}
              onDayPress={handleDayPress}
              primary={colors.primary}
              success={colors.success}
              isDark={isDark}
              mutedForeground={colors.mutedForeground}
            />

            <CalendarLegend
              primary={colors.primary}
              success={colors.success}
              isDark={isDark}
            />

            <AppText
              variant="caption2"
              style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 4 }}
            >
              Tap any day to view details
            </AppText>
          </>
        )}
      </View>
    </Animated.View>
  );
});

ActivityCalendar.displayName = 'ActivityCalendar';
export default ActivityCalendar;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: CARD_PADDING,
    marginBottom: 16,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthPickerOuter: {
    marginHorizontal: -CARD_PADDING,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 32,
  },
});
