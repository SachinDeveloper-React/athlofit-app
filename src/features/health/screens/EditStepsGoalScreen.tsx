import { memo } from 'react';
import { AppText, AppView, Header, Screen } from '../../../components';
import { StepCounter } from '../components/edit-steps-goal/StepCounter';
import { StepsSlider } from '../components/edit-steps-goal/StepsSlider';
import { PresetSelector } from '../components/edit-steps-goal/PresetSelector';
import { StatsRow } from '../components/edit-steps-goal/StatsRow';
import { SaveButton } from '../components/edit-steps-goal/SaveButton';
import { useStepsGoal } from '../hooks/useStepsGoal';
import { useAuthStore } from '../../auth/store/authStore';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../../../components/Toast';
import { makeStyles } from '../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, fontWeight }) => ({
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
}));

const EditStepsGoalScreen = memo(() => {
  const styles = useStyles();
  const user = useAuthStore(state => state.user);
  const navigation = useNavigation();
  const { success, error } = useToast();

  const {
    steps,
    activePreset,
    presets,
    stats,
    formattedSteps,
    handleSlider,
    handlePreset,
    saveMutation,
  } = useStepsGoal(user?.dailyStepGoal || 8000);

  const handleSave = () => {
    saveMutation.mutate(steps, {
      onSuccess: () => {
        success('Daily step goal updated successfully');
        navigation.goBack();
      },
      onError: (err) => {
        error(err.message || 'Failed to update goal');
      }
    });
  };
  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Edit Steps Goal" showBack backLabel="" />}
    >
      <AppText variant='caption1' style={styles.sectionLabel}>Daily fitness</AppText>
      <AppText variant='title1' style={styles.title}>Set your steps goal</AppText>
      <AppText variant='subhead' style={styles.subtitle}>
        Choose a daily target that fits your lifestyle. You can update this
        anytime.
      </AppText>

      <AppView style={styles.divider} />

      <StepCounter formattedSteps={formattedSteps} />

      <StepsSlider value={steps} onValueChange={handleSlider} />
      <PresetSelector
        presets={presets}
        activePreset={activePreset}
        onSelect={handlePreset}
      />

      <StatsRow stats={stats} />

      <SaveButton
        onPress={handleSave}
        loading={saveMutation.isPending}
      />
    </Screen>
  );
});

export default EditStepsGoalScreen;
