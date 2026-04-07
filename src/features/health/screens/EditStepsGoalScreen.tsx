import { memo } from 'react';
import { AppText, AppView, Header, Screen } from '../../../components';
import { StepCounter } from '../components/edit-steps-goal/StepCounter';
import { StepsSlider } from '../components/edit-steps-goal/StepsSlider';
import { PresetSelector } from '../components/edit-steps-goal/PresetSelector';
import { StatsRow } from '../components/edit-steps-goal/StatsRow';
import { SaveButton } from '../components/edit-steps-goal/SaveButton';
import { StyleSheet } from 'react-native';
import { useStepsGoal } from '../hooks/useStepsGoal';
import { useAuthStore } from '../../auth/store/authStore';
import { useNavigation } from '@react-navigation/native';
import { useToast } from '../../../components/Toast';

const EditStepsGoalScreen = memo(() => {
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
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    marginVertical: 6,
  },
  title: {
    color: '#111',
    marginBottom: 6,
  },
  subtitle: {
    lineHeight: 21,
    marginBottom: 24,
  },
  divider: {
    height: 0.5,
    backgroundColor: '#E5E5E5',
    marginBottom: 24,
  },
});
