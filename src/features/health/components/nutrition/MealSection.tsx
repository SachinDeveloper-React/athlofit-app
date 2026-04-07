// ─── MealSection.tsx ──────────────────────────────────────────────────────────
// Collapsible accordion for a single meal group (Breakfast / Lunch / Dinner / Snacks).
// Lists logged entries, allows adding new ones and deleting existing ones.

import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Animated } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { MealLogBottomSheet } from './MealLogBottomSheet';
import type { MealEntry, MealMeta, LogMealRequest } from '../../types/nutrition.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  meta: MealMeta;
  entries: MealEntry[];
  onAddMeal: (entry: LogMealRequest) => void;
  onDeleteMeal: (id: string) => void;
  isAdding?: boolean;
  isDeleting?: boolean;
}

// ─── Entry Row ────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: MealEntry;
  accentColor: string;
  onDelete: (id: string) => void;
}

const EntryRow = memo(({ entry, accentColor, onDelete }: EntryRowProps) => {
  const { colors } = useTheme();

  return (
    <View style={styles.entryRow}>
      {/* Color dot */}
      <View style={[styles.entryDot, { backgroundColor: accentColor }]} />

      {/* Name + macros */}
      <AppView style={styles.entryInfo}>
        <AppText variant="subhead" weight="semiBold" numberOfLines={1}>
          {entry.name}
        </AppText>
        <AppView style={styles.entryMacros}>
          {entry.protein !== undefined && (
            <AppText variant="caption2">P: {entry.protein}g</AppText>
          )}
          {entry.carbs !== undefined && (
            <AppText variant="caption2">C: {entry.carbs}g</AppText>
          )}
          {entry.fat !== undefined && (
            <AppText variant="caption2">F: {entry.fat}g</AppText>
          )}
          {entry.quantity !== undefined && (
            <AppText variant="caption2">
              {entry.quantity} {entry.unit ?? ''}
            </AppText>
          )}
        </AppView>
      </AppView>

      {/* Calories */}
      <AppText variant="subhead" weight="bold" color={accentColor}>
        {entry.calories}
        <AppText variant="caption2"> kcal</AppText>
      </AppText>

      {/* Delete */}
      <TouchableOpacity
        onPress={() => onDelete(entry._id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.deleteBtn}
      >
        <Icon name="Trash2" size={16} color={withOpacity(colors.destructive, 0.7)} />
      </TouchableOpacity>
    </View>
  );
});

EntryRow.displayName = 'EntryRow';

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyMeal = memo(({ emoji }: { emoji: string }) => (
  <AppView style={styles.empty}>
    <AppText style={styles.emptyEmoji}>{emoji}</AppText>
    <AppText variant="caption1">Nothing logged yet</AppText>
  </AppView>
));

EmptyMeal.displayName = 'EmptyMeal';

// ─── Main Component ───────────────────────────────────────────────────────────

export const MealSection = memo(
  ({ meta, entries, onAddMeal, onDeleteMeal, isAdding, isDeleting }: Props) => {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);

    const totalCal = entries.reduce((s, e) => s + e.calories, 0);

    const toggle = useCallback(() => setExpanded(p => !p), []);
    const openSheet = useCallback(() => setSheetVisible(true), []);
    const closeSheet = useCallback(() => setSheetVisible(false), []);

    const handleSubmit = useCallback(
      (entry: LogMealRequest) => {
        onAddMeal(entry);
        closeSheet();
      },
      [onAddMeal, closeSheet],
    );

    return (
      <>
        <Card style={styles.card}>
          {/* ── Header row (always visible) ── */}
          <TouchableOpacity
            onPress={toggle}
            activeOpacity={0.75}
            style={styles.headerRow}
          >
            {/* Emoji badge */}
            <View style={[styles.emojiBadge, { backgroundColor: meta.bg }]}>
              <AppText style={styles.emoji}>{meta.emoji}</AppText>
            </View>

            {/* Title + count */}
            <AppView style={styles.titleCol}>
              <AppText variant="headline">{meta.label}</AppText>
              <AppText variant="caption2">{meta.timeHint}</AppText>
            </AppView>

            {/* Calorie summary & chevron */}
            <AppView style={styles.rightSide}>
              <AppText
                variant="subhead"
                weight="bold"
                color={totalCal > 0 ? meta.color : colors.mutedForeground}
              >
                {totalCal > 0 ? `${totalCal} kcal` : '—'}
              </AppText>
              <AppText
                variant="caption2"
                style={[
                  styles.entryCount,
                  { backgroundColor: withOpacity(meta.color, 0.12) },
                ]}
                color={meta.color}
              >
                {entries.length}
              </AppText>
              <Icon
                name={expanded ? 'ChevronUp' : 'ChevronDown'}
                size={18}
                color={colors.mutedForeground}
              />
            </AppView>
          </TouchableOpacity>

          {/* ── Expanded body ── */}
          {expanded && (
            <AppView style={styles.body}>
              {/* Divider */}
              <View
                style={[
                  styles.divider,
                  { backgroundColor: withOpacity(meta.color, 0.15) },
                ]}
              />

              {/* Entries */}
              {entries.length === 0 ? (
                <EmptyMeal emoji={meta.emoji} />
              ) : (
                <AppView style={styles.entries}>
                  {entries.map(entry => (
                    <EntryRow
                      key={entry._id}
                      entry={entry}
                      accentColor={meta.color}
                      onDelete={onDeleteMeal}
                    />
                  ))}
                </AppView>
              )}

              {/* Add button */}
              <TouchableOpacity
                onPress={openSheet}
                activeOpacity={0.8}
                style={[styles.addBtn, { borderColor: meta.color }]}
              >
                <Icon name="Plus" size={16} color={meta.color} />
                <AppText
                  variant="subhead"
                  weight="semiBold"
                  color={meta.color}
                  style={styles.addLabel}
                >
                  Add {meta.label}
                </AppText>
              </TouchableOpacity>
            </AppView>
          )}
        </Card>

        {/* ── Log Bottom Sheet ── */}
        <MealLogBottomSheet
          visible={sheetVisible}
          meal={meta}
          onClose={closeSheet}
          onSubmit={handleSubmit}
          isSubmitting={isAdding}
        />
      </>
    );
  },
);

MealSection.displayName = 'MealSection';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { gap: 0, padding: 0, overflow: 'hidden' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  titleCol: { flex: 1 },
  rightSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    textAlign: 'center',
    lineHeight: 20,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  divider: { height: 1, marginHorizontal: -16 },
  entries: { gap: 12, marginTop: 4 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryDot: { width: 8, height: 8, borderRadius: 4 },
  entryInfo: { flex: 1 },
  entryMacros: { flexDirection: 'row', gap: 6, marginTop: 2 },
  deleteBtn: { padding: 4 },
  empty: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
    opacity: 0.5,
  },
  emptyEmoji: { fontSize: 28 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    borderStyle: 'dashed',
    paddingVertical: 10,
  },
  addLabel: { fontSize: 14 },
});
