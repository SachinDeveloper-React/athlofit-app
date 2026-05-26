import React, { memo, useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText, AppView, Button, Header, Screen } from '../../../components';
import { useHydrationStore } from '../store/hydrationStore';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../../../components/Toast';
import { makeStyles } from '../../../hooks/makeStyles';
import { useTheme } from '../../../hooks/useTheme';
import Slider from '@react-native-community/slider';

const PRESETS = [1500, 2000, 2500, 3000, 3500, 4000];
const MIN_GOAL = 500;
const MAX_GOAL = 5000;
const STEP = 100;

const useStyles = makeStyles(({ colors, spacing, fontWeight, fontSize }) => ({
  container: {
    paddingHorizontal: spacing[6],
  },
  sectionLabel: {
    textTransform: 'uppercase' as const,
    marginVertical: spacing[1.5],
  },
  title: {
    color: colors.foreground,
    marginBottom: spacing[1.5],
  },
  subtitle: {
    lineHeight: 21,
    marginBottom: spacing[6],
  },
  divider: {
    height: 0.5,
    backgroundColor: colors.border,
    marginBottom: spacing[6],
  },
  goalDisplay: {
    alignItems: 'center' as const,
    marginBottom: spacing[6],
  },
  goalValue: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  goalUnit: {
    fontSize: fontSize.md,
    color: colors.mutedForeground,
    marginTop: spacing[1],
  },
  sliderContainer: {
    marginBottom: spacing[6],
    paddingHorizontal: spacing[2],
  },
  sliderLabels: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginTop: spacing[1],
  },
  sliderLabel: {
    fontSize: fontSize.xs,
    color: colors.mutedForeground,
  },
  presetsContainer: {
    marginBottom: spacing[6],
  },
  presetsLabel: {
    marginBottom: spacing[3],
    fontWeight: fontWeight.medium,
  },
  presetsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing[2],
  },
  presetChip: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  presetText: {
    fontSize: fontSize.sm,
    color: colors.foreground,
  },
  presetTextActive: {
    color: '#fff',
    fontWeight: fontWeight.semibold,
  },
  saveContainer: {
    marginTop: spacing[8],
  },
}));

const EditHydrationGoalScreen = memo(() => {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const { success } = useToast();

  const currentGoal = useHydrationStore(s => s.dailyGoal);
  const setDailyGoal = useHydrationStore(s => s.setDailyGoal);

  const [goal, setGoal] = useState(currentGoal);

  const activePreset = PRESETS.find(p => p === goal) ?? null;

  const handleSlider = useCallback((value: number) => {
    setGoal(Math.round(value / STEP) * STEP);
  }, []);

  const handlePreset = useCallback((preset: number) => {
    setGoal(preset);
  }, []);

  const handleSave = useCallback(() => {
    setDailyGoal(goal);
    success('Hydration goal updated successfully');
    navigation.goBack();
  }, [goal, setDailyGoal, success, navigation]);

  const formattedGoal = goal >= 1000
    ? `${(goal / 1000).toFixed(goal % 1000 === 0 ? 0 : 1)}L`
    : `${goal}ml`;

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Edit Water Goal" showBack backLabel="" />}
    >
      <AppText variant="caption1" style={styles.sectionLabel}>
        Daily hydration
      </AppText>
      <AppText variant="title1" style={styles.title}>
        Set your water goal
      </AppText>
      <AppText variant="subhead" style={styles.subtitle}>
        Choose a daily water intake target. The recommended amount is 2–3 liters
        per day. You can update this anytime.
      </AppText>

      <AppView style={styles.divider} />

      {/* Goal display */}
      <AppView style={styles.goalDisplay}>
        <AppText style={styles.goalValue}>{goal}</AppText>
        <AppText style={styles.goalUnit}>ml per day ({formattedGoal})</AppText>
      </AppView>

      {/* Slider */}
      <AppView style={styles.sliderContainer}>
        <Slider
          minimumValue={MIN_GOAL}
          maximumValue={MAX_GOAL}
          step={STEP}
          value={goal}
          onValueChange={handleSlider}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
        />
        <AppView style={styles.sliderLabels}>
          <AppText style={styles.sliderLabel}>{MIN_GOAL}ml</AppText>
          <AppText style={styles.sliderLabel}>{MAX_GOAL}ml</AppText>
        </AppView>
      </AppView>

      {/* Presets */}
      <AppView style={styles.presetsContainer}>
        <AppText variant="subhead" style={styles.presetsLabel}>
          Quick presets
        </AppText>
        <AppView style={styles.presetsRow}>
          {PRESETS.map(preset => (
            <View
              key={preset}
              style={[
                styles.presetChip,
                activePreset === preset && styles.presetChipActive,
              ]}
              onTouchEnd={() => handlePreset(preset)}
            >
              <AppText
                style={[
                  styles.presetText,
                  activePreset === preset && styles.presetTextActive,
                ]}
              >
                {preset >= 1000
                  ? `${(preset / 1000).toFixed(preset % 1000 === 0 ? 0 : 1)}L`
                  : `${preset}ml`}
              </AppText>
            </View>
          ))}
        </AppView>
      </AppView>

      {/* Save button */}
      <AppView style={styles.saveContainer}>
        <Button
          label="Save Goal"
          onPress={handleSave}
          disabled={goal === currentGoal}
        />
      </AppView>
    </Screen>
  );
});

export default EditHydrationGoalScreen;
