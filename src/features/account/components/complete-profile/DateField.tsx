/**
 * DateField.tsx
 *
 * A tappable field that opens a calendar bottom-sheet.
 * No external date-picker library required — built entirely with RN primitives
 * and the project's existing BottomSheet component.
 *
 * Value format: "YYYY-MM-DD"  (ISO date, same as before)
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../../../hooks/useTheme';
import { DateFieldProps } from '../../types/completeProfile.types';
import { AppView, AppText } from '../../../../components';
import { Icon } from '../../../../components';
import { BottomSheet } from '../../../../components';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MIN_YEAR = new Date().getFullYear() - 120;
const MAX_YEAR = new Date().getFullYear() - 13; // must be at least 13

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0 = Sunday
}

function parseValue(value: string): { year: number; month: number; day: number } | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

function formatDisplay(value: string): string {
  const p = parseValue(value);
  if (!p) return '';
  return `${String(p.day).padStart(2, '0')} ${MONTHS[p.month]} ${p.year}`;
}

// ─── Year picker ──────────────────────────────────────────────────────────────

function YearPicker({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (y: number) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = MAX_YEAR; y >= MIN_YEAR; y--) arr.push(y);
    return arr;
  }, []);

  return (
    <ScrollView
      style={{ maxHeight: 260 }}
      showsVerticalScrollIndicator={false}
    >
      {years.map(y => {
        const active = y === selected;
        return (
          <Pressable
            key={y}
            onPress={() => onSelect(y)}
            style={[
              styles.yearRow,
              active && { backgroundColor: colors.primary + '18', borderRadius: radius.md },
            ]}
          >
            <AppText
              variant="body"
              weight={active ? 'bold' : 'regular'}
              style={{ color: active ? colors.primary : colors.foreground }}
            >
              {y}
            </AppText>
            {active && <Icon name="Check" size={16} color={colors.primary} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  year,
  month,
  selectedDay,
  onDayPress,
}: {
  year: number;
  month: number;
  selectedDay: number | null;
  onDayPress: (day: number) => void;
}) {
  const { colors, radius } = useTheme();
  const total = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);

  // Build a 6-row × 7-col grid (42 cells)
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const isToday = (d: number) =>
    d === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  return (
    <View>
      {/* Day-of-week header */}
      <View style={styles.weekRow}>
        {DAYS_SHORT.map(d => (
          <AppText
            key={d}
            variant="caption1"
            weight="semiBold"
            style={[styles.weekLabel, { color: colors.mutedForeground }]}
          >
            {d}
          </AppText>
        ))}
      </View>

      {/* Day cells */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={styles.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={styles.dayCell} />;

            const selected = day === selectedDay;
            const todayMark = isToday(day);

            return (
              <Pressable
                key={col}
                onPress={() => onDayPress(day)}
                style={[
                  styles.dayCell,
                  selected && {
                    backgroundColor: colors.primary,
                    borderRadius: radius.full,
                  },
                  !selected && todayMark && {
                    borderWidth: 1.5,
                    borderColor: colors.primary,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <AppText
                  variant="subhead"
                  weight={selected ? 'bold' : 'regular'}
                  style={{
                    color: selected
                      ? '#fff'
                      : todayMark
                      ? colors.primary
                      : colors.foreground,
                  }}
                >
                  {day}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export const DateField: React.FC<DateFieldProps> = ({ value, onChange, error }) => {
  const { colors, spacing, radius } = useTheme();

  // Parse current value
  const parsed = parseValue(value);

  // Calendar state — default to MAX_YEAR / current month if nothing selected
  const defaultYear = parsed?.year ?? MAX_YEAR;
  const defaultMonth = parsed?.month ?? new Date().getMonth();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(defaultYear);
  const [viewMonth, setViewMonth] = useState(defaultMonth);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const selectedDay = parsed?.year === viewYear && parsed?.month === viewMonth
    ? parsed.day
    : null;

  const handleDayPress = useCallback((day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  }, [viewYear, viewMonth, onChange]);

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      if (viewYear > MIN_YEAR) { setViewYear(y => y - 1); setViewMonth(11); }
    } else {
      setViewMonth(m => m - 1);
    }
  }, [viewMonth, viewYear]);

  const nextMonth = useCallback(() => {
    const maxDate = new Date(MAX_YEAR, 11, 31);
    const nextDate = new Date(viewYear, viewMonth + 1, 1);
    if (nextDate > maxDate) return;
    if (viewMonth === 11) {
      setViewYear(y => y + 1); setViewMonth(0);
    } else {
      setViewMonth(m => m + 1);
    }
  }, [viewMonth, viewYear]);

  const canGoNext = useMemo(() => {
    return !(viewYear === MAX_YEAR && viewMonth === 11);
  }, [viewYear, viewMonth]);

  const borderColor = error ? colors.destructive : colors.border;
  const displayText = formatDisplay(value);

  return (
    <AppView style={{ marginBottom: 16 }}>
      {/* Label */}
      <AppText
        style={[
          styles.label,
          { color: error ? colors.destructive : colors.foreground },
        ]}
      >
        Date of Birth
      </AppText>

      {/* Trigger */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          setShowYearPicker(false);
          setOpen(true);
        }}
        style={[
          styles.trigger,
          {
            backgroundColor: colors.inputBackground,
            borderColor,
            borderWidth: 1,
          },
        ]}
      >
        <Icon
          name="CalendarDays"
          size={18}
          color={displayText ? colors.primary : colors.mutedForeground}
        />
        <AppText
          variant="body"
          style={[
            styles.triggerText,
            { color: displayText ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {displayText || 'Select date of birth'}
        </AppText>
        <Icon name="ChevronDown" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <AppText style={[styles.errorText, { color: colors.destructive }]}>
          {error}
        </AppText>
      )}

      {/* Calendar bottom sheet */}
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Date of Birth"
      >
        {showYearPicker ? (
          <>
            {/* Year picker header */}
            <View style={styles.calHeader}>
              <TouchableOpacity
                onPress={() => setShowYearPicker(false)}
                style={styles.navBtn}
              >
                <Icon name="ChevronLeft" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <AppText variant="subhead" weight="bold">
                Select Year
              </AppText>
              <View style={styles.navBtn} />
            </View>
            <YearPicker
              selected={viewYear}
              onSelect={y => {
                setViewYear(y);
                setShowYearPicker(false);
              }}
            />
          </>
        ) : (
          <>
            {/* Month / year navigation */}
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                <Icon name="ChevronLeft" size={20} color={colors.foreground} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowYearPicker(true)}
                style={styles.monthYearBtn}
              >
                <AppText variant="subhead" weight="bold">
                  {MONTHS[viewMonth]} {viewYear}
                </AppText>
                <Icon name="ChevronDown" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={nextMonth}
                style={[styles.navBtn, !canGoNext && { opacity: 0.3 }]}
                disabled={!canGoNext}
              >
                <Icon name="ChevronRight" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            {/* Grid */}
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              selectedDay={selectedDay}
              onDayPress={handleDayPress}
            />
          </>
        )}
      </BottomSheet>
    </AppView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 10,
  },
  triggerText: { flex: 1 },
  errorText: { fontSize: 12, marginTop: 4 },

  // Calendar
  calHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  weekLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 2,
  },
});
