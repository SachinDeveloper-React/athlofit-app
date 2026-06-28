// ─── CalorieGoalEditor.tsx ─────────────────────────────────────────────────────
// Tappable card showing the current daily calorie goal with an edit icon.
// Opens a bottom sheet with preset quick-pick buttons + custom numeric input.

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { AppText, AppView, Button, Card } from '../../../../components';
import { Icon } from '../../../../components';
import BottomSheet from '../../../../components/BottomSheet';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';

// ─── Preset calorie targets ───────────────────────────────────────────────────

const PRESETS = [
  { label: '1,200', value: 1200, hint: 'Aggressive loss' },
  { label: '1,500', value: 1500, hint: 'Weight loss' },
  { label: '2,000', value: 2000, hint: 'Maintenance' },
  { label: '2,500', value: 2500, hint: 'Muscle gain' },
  { label: '3,000', value: 3000, hint: 'Bulking' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  currentGoal: number;
  onUpdate: (newGoal: number) => void;
  isMutating?: boolean;
}

// ─── Animated Preset Chip ─────────────────────────────────────────────────────

interface PresetChipProps {
  label: string;
  hint: string;
  value: number;
  isActive: boolean;
  accentColor: string;
  onPress: (v: number) => void;
}

const PresetChip = memo(({ label, hint, value, isActive, accentColor, onPress }: PresetChipProps) => {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => onPress(value)}
      style={[
        styles.presetChip,
        isActive
          ? { backgroundColor: accentColor, borderColor: accentColor }
          : { backgroundColor: withOpacity(colors.foreground, 0.04), borderColor: withOpacity(colors.foreground, 0.1) },
      ]}
    >
      <AppText
        variant="subhead"
        weight={isActive ? 'bold' : 'semiBold'}
        color={isActive ? '#ffffff' : colors.foreground}
      >
        {label}
      </AppText>
      <AppText
        variant="caption2"
        color={isActive ? 'rgba(255,255,255,0.8)' : colors.mutedForeground}
      >
        {hint}
      </AppText>
    </TouchableOpacity>
  );
});

PresetChip.displayName = 'PresetChip';

// ─── Main Component ───────────────────────────────────────────────────────────

export const CalorieGoalEditor = memo(({ currentGoal, onUpdate, isMutating }: Props) => {
  const { colors } = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [selectedValue, setSelectedValue] = useState(currentGoal);
  const [customInput, setCustomInput] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [error, setError] = useState('');

  // Pulse animation on the goal number when it updates
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Sync local state when server value changes
  useEffect(() => {
    setSelectedValue(currentGoal);
    // Pulse animation
    scale.value = withSequence(
      withSpring(1.05, { damping: 8 }),
      withSpring(1, { damping: 10 }),
    );
  }, [currentGoal]);

  const openSheet = useCallback(() => {
    setSelectedValue(currentGoal);
    setCustomInput('');
    setIsCustomMode(!PRESETS.some(p => p.value === currentGoal));
    if (!PRESETS.some(p => p.value === currentGoal)) {
      setCustomInput(String(currentGoal));
    }
    setError('');
    setSheetVisible(true);
  }, [currentGoal]);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handlePresetPress = useCallback((value: number) => {
    setSelectedValue(value);
    setIsCustomMode(false);
    setCustomInput('');
    setError('');
  }, []);

  const handleCustomToggle = useCallback(() => {
    setIsCustomMode(true);
    setCustomInput(String(selectedValue));
    setError('');
  }, [selectedValue]);

  const handleCustomChange = useCallback((text: string) => {
    // Allow only numeric input
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomInput(cleaned);
    setError('');

    const num = Number(cleaned);
    if (cleaned && num >= 500 && num <= 10000) {
      setSelectedValue(num);
    }
  }, []);

  const handleSave = useCallback(() => {
    let goal = selectedValue;

    if (isCustomMode) {
      const num = Number(customInput);
      if (!customInput || isNaN(num)) {
        setError('Enter a valid number');
        return;
      }
      if (num < 500) {
        setError('Minimum is 500 kcal');
        return;
      }
      if (num > 10000) {
        setError('Maximum is 10,000 kcal');
        return;
      }
      goal = num;
    }

    if (goal === currentGoal) {
      closeSheet();
      return;
    }

    onUpdate(goal);
    closeSheet();
  }, [selectedValue, isCustomMode, customInput, currentGoal, onUpdate, closeSheet]);

  const isPreset = PRESETS.some(p => p.value === selectedValue) && !isCustomMode;
  const hasChanged = selectedValue !== currentGoal;

  return (
    <>
      {/* ─── Tappable Card ─────────────────────────────────────────────── */}
      <TouchableOpacity activeOpacity={0.8} onPress={openSheet}>
        <Card style={styles.card}>
          <AppView style={styles.cardRow}>
            <AppView style={[styles.iconCircle, { backgroundColor: withOpacity(colors.primary, 0.12) }]}>
              <AppText style={{ fontSize: 20 }}>🎯</AppText>
            </AppView>

            <AppView style={styles.cardText}>
              <AppText variant="caption1" color={colors.mutedForeground}>
                Daily Calorie Goal
              </AppText>
              <Animated.View style={animStyle}>
                <AppText variant="title3" weight="bold">
                  {currentGoal.toLocaleString()} kcal
                </AppText>
              </Animated.View>
            </AppView>

            <AppView style={[styles.editBadge, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
              <Icon name="Pencil" size={14} color={colors.primary} />
              <AppText variant="caption2" weight="semiBold" color={colors.primary}>
                Edit
              </AppText>
            </AppView>
          </AppView>

          {isMutating && (
            <AppView style={[styles.savingOverlay, { backgroundColor: withOpacity(colors.card, 0.8) }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText variant="caption2" color={colors.mutedForeground} style={{ marginLeft: 8 }}>
                Saving…
              </AppText>
            </AppView>
          )}
        </Card>
      </TouchableOpacity>

      {/* ─── Bottom Sheet ──────────────────────────────────────────────── */}
      <BottomSheet
        visible={sheetVisible}
        onClose={closeSheet}
        title="Set Calorie Goal"
        snapHeight="55%"
        showCloseButton
      >
        <AppView style={styles.sheetContent}>
          {/* Description */}
          <AppText variant="caption1" color={colors.mutedForeground} style={styles.description}>
            Choose a preset or enter a custom target (500 – 10,000 kcal/day).
          </AppText>

          {/* Preset Grid */}
          <AppView style={styles.presetGrid}>
            {PRESETS.map(p => (
              <PresetChip
                key={p.value}
                label={p.label}
                hint={p.hint}
                value={p.value}
                isActive={selectedValue === p.value && !isCustomMode}
                accentColor={colors.primary}
                onPress={handlePresetPress}
              />
            ))}

            {/* Custom chip */}
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={handleCustomToggle}
              style={[
                styles.presetChip,
                isCustomMode
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: withOpacity(colors.foreground, 0.04), borderColor: withOpacity(colors.foreground, 0.1) },
              ]}
            >
              <AppText
                variant="subhead"
                weight={isCustomMode ? 'bold' : 'semiBold'}
                color={isCustomMode ? '#ffffff' : colors.foreground}
              >
                Custom
              </AppText>
              <AppText
                variant="caption2"
                color={isCustomMode ? 'rgba(255,255,255,0.8)' : colors.mutedForeground}
              >
                Enter value
              </AppText>
            </TouchableOpacity>
          </AppView>

          {/* Custom Input (shown when custom mode is active) */}
          {isCustomMode && (
            <AppView style={styles.customInputRow}>
              <AppView
                style={[
                  styles.customInputBox,
                  {
                    backgroundColor: colors.inputBackground ?? colors.secondary,
                    borderColor: error ? colors.destructive : colors.border,
                  },
                ]}
              >
                <TextInput
                  value={customInput}
                  onChangeText={handleCustomChange}
                  placeholder="e.g. 1800"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  style={[styles.customTextInput, { color: colors.foreground }]}
                  maxLength={5}
                  autoFocus
                />
                <AppText variant="caption1" color={colors.mutedForeground}>
                  kcal/day
                </AppText>
              </AppView>
              {error ? (
                <AppText variant="caption2" color={colors.destructive} style={styles.errorText}>
                  {error}
                </AppText>
              ) : null}
            </AppView>
          )}

          {/* Save Button */}
          <Button
            label={isMutating ? 'Saving…' : hasChanged ? 'Save Goal' : 'Done'}
            onPress={handleSave}
            variant="primary"
            size="lg"
            fullWidth
            disabled={isMutating}
            loading={isMutating}
          />
        </AppView>
      </BottomSheet>
    </>
  );
});

CalorieGoalEditor.displayName = 'CalorieGoalEditor';

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Card
  card: {
    position: 'relative',
    overflow: 'hidden',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  editBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  // Sheet
  sheetContent: {
    flex: 1,
    gap: 16,
  },
  description: {
    textAlign: 'center',
    marginBottom: 4,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  presetChip: {
    width: '30%' as any,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 2,
  },

  // Custom input
  customInputRow: {
    gap: 6,
  },
  customInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 50,
    gap: 8,
  },
  customTextInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    marginLeft: 4,
  },
});
