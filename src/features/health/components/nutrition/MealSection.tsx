// ─── MealSection.tsx ──────────────────────────────────────────────────────────
import React, { memo, useCallback, useState } from 'react';
import { TouchableOpacity, View, Animated } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { Icon } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { MealLogBottomSheet } from './MealLogBottomSheet';
import type { MealEntry, MealMeta, LogMealRequest } from '../../types/nutrition.types';
import { makeStyles } from '../../../../hooks/makeStyles';

interface Props {
  meta: MealMeta;
  entries: MealEntry[];
  onAddMeal: (entry: LogMealRequest) => void;
  onDeleteMeal: (id: string) => void;
  isAdding?: boolean;
  isDeleting?: boolean;
}

interface EntryRowProps {
  entry: MealEntry;
  accentColor: string;
  onDelete: (id: string) => void;
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  card: { gap: 0, padding: 0, overflow: 'hidden' as const },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    padding: spacing[4],
  },
  emojiBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emoji: { fontSize: 22 },
  titleCol: { flex: 1 },
  rightSide: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  entryCount: {
    minWidth: spacing[5],
    height: spacing[5],
    borderRadius: spacing[2.5],
    paddingHorizontal: spacing[1.5],
    textAlign: 'center' as const,
    lineHeight: spacing[5],
    overflow: 'hidden' as const,
  },
  body: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  divider: { height: 1, marginHorizontal: -spacing[4] },
  entries: { gap: spacing[3], marginTop: spacing[1] },
  entryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2.5],
  },
  entryDot: { width: 8, height: 8, borderRadius: radius.full },
  entryInfo: { flex: 1 },
  entryMacros: { flexDirection: 'row' as const, gap: spacing[1.5], marginTop: spacing[0.5] },
  deleteBtn: { padding: spacing[1] },
  empty: {
    alignItems: 'center' as const,
    paddingVertical: spacing[4],
    gap: spacing[1.5],
    opacity: 0.5,
  },
  emptyEmoji: { fontSize: 28 },
  addBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[1.5],
    borderWidth: 1.5,
    borderRadius: spacing[2.5],
    borderStyle: 'dashed' as const,
    paddingVertical: spacing[2.5],
  },
  addLabel: { fontSize: 14 },
}));

const EntryRow = memo(({ entry, accentColor, onDelete }: EntryRowProps) => {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={styles.entryRow}>
      <View style={[styles.entryDot, { backgroundColor: accentColor }]} />
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
      <AppText variant="subhead" weight="bold" color={accentColor}>
        {entry.calories}
        <AppText variant="caption2"> kcal</AppText>
      </AppText>
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

const EmptyMeal = memo(({ emoji }: { emoji: string }) => {
  const styles = useStyles();
  return (
    <AppView style={styles.empty}>
      <AppText style={styles.emptyEmoji}>{emoji}</AppText>
      <AppText variant="caption1">Nothing logged yet</AppText>
    </AppView>
  );
});

EmptyMeal.displayName = 'EmptyMeal';

export const MealSection = memo(
  ({ meta, entries, onAddMeal, onDeleteMeal, isAdding, isDeleting }: Props) => {
    const { colors } = useTheme();
    const styles = useStyles();
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
          <TouchableOpacity
            onPress={toggle}
            activeOpacity={0.75}
            style={styles.headerRow}
          >
            <View style={[styles.emojiBadge, { backgroundColor: meta.bg }]}>
              <AppText style={styles.emoji}>{meta.emoji}</AppText>
            </View>

            <AppView style={styles.titleCol}>
              <AppText variant="headline">{meta.label}</AppText>
              <AppText variant="caption2">{meta.timeHint}</AppText>
            </AppView>

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

          {expanded && (
            <AppView style={styles.body}>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: withOpacity(meta.color, 0.15) },
                ]}
              />

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
