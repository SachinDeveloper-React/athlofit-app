import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import { useToast } from '../../../components/Toast';

import { ProfileSetupRoutes } from '../../../navigation/routes';
import {
  BodyFormValues,
  PersonalFormValues,
} from '../utils/profileSetup.validation';
import { useCompleteProfile } from '../hooks/useCompleteProfile';
import { ProfileSetupScreenProps } from '../../../types/navigation.types';
import { TOTAL_STEPS } from '../constants/completeProfile.constant';
import { Step1Personal } from '../components/complete-profile/Step1Personal';
import { Step2Body } from '../components/complete-profile/Step2Body';

type Props = ProfileSetupScreenProps<
  typeof ProfileSetupRoutes.COMPLETE_PROFILE
>;

const CompleteProfileScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<PersonalFormValues | null>(null);

  const { mutate: completeProfile, isPending } = useCompleteProfile();

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  const advanceProgress = () => {
    Animated.timing(progressAnim, {
      toValue: step === 1 ? 1 : 1,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const handleStep1 = (values: PersonalFormValues) => {
    setStep1Data(values);
    advanceProgress();
    setStep(2);
  };

  const handleStep2 = (values: BodyFormValues) => {
    if (!step1Data) return;

    completeProfile(
      { ...step1Data, ...values },
      {
        onSuccess: res => {
          if (res.success) {
            toast.success('Profile completed! Welcome aboard 🎉');
            // RootNavigator sees user.isProfileComplete=true → renders TabNavigator
          } else {
            toast.error(res.message ?? 'Something went wrong');
          }
        },
        onError: (err: any) => {
          toast.error(err?.message ?? 'Failed to save profile');
        },
      },
    );
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Animated step width based on current step
  const currentProgress = step / TOTAL_STEPS;

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* ── Top bar ── */}
      <View
        style={[
          s.topBar,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        {step > 1 && (
          <TouchableOpacity
            onPress={() => setStep(s => s - 1)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={s.backBtn}
          >
            <Text style={[s.backText, { color: colors.primary }]}>‹ Back</Text>
          </TouchableOpacity>
        )}
        <View style={s.stepLabel}>
          <Text style={[s.stepCounter, { color: colors.mutedForeground }]}>
            Step {step} of {TOTAL_STEPS}
          </Text>
        </View>
        {/* Skip (optional) */}
        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[s.skipText, { color: colors.mutedForeground }]}> </Text>
        </TouchableOpacity>
      </View>

      {/* ── Progress bar ── */}
      <View style={[s.progressTrack, { backgroundColor: colors.secondary }]}>
        <View
          style={[
            s.progressFill,
            {
              backgroundColor: colors.primary,
              width: `${(step / TOTAL_STEPS) * 100}%`,
            },
          ]}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.form}>
          {step === 1 && <Step1Personal onNext={handleStep1} colors={colors} />}
          {step === 2 && (
            <Step2Body
              onSubmit={handleStep2}
              loading={isPending}
              colors={colors}
            />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {},
  backText: { fontSize: 17, fontWeight: '400', minWidth: 60 },
  stepLabel: { flex: 1, alignItems: 'center' },
  stepCounter: { fontSize: 13, fontWeight: '500' },
  skipText: { fontSize: 15, minWidth: 60, textAlign: 'right' },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  scroll: { flexGrow: 1 },
  form: { paddingHorizontal: 24, paddingTop: 8 },
  stepContent: { paddingTop: 28 },
  stepIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  stepIcon: { fontSize: 28 },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  stepSubtitle: { fontSize: 15, lineHeight: 22, marginBottom: 28 },
  nextBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  nextBtnArrow: { color: '#fff', fontSize: 17 },
});

export default CompleteProfileScreen;
