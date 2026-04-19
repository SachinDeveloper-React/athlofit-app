import React, { useState, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { AppView, Header, Screen } from '../../../components';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { useToast } from '../../../components/Toast';
import { ProfileSetupRoutes } from '../../../navigation/routes';
import { BodyFormValues, PersonalFormValues } from '../utils/profileSetup.validation';
import { useCompleteProfile } from '../hooks/useCompleteProfile';
import { ProfileSetupScreenProps } from '../../../types/navigation.types';
import { TOTAL_STEPS } from '../constants/completeProfile.constant';
import { Step1Personal } from '../components/complete-profile/Step1Personal';
import { Step2Body } from '../components/complete-profile/Step2Body';
import AvatarPickerModal from '../components/AvatarPickerModal';
import { BASE_URL } from '../../../utils/api';
import { tokenService } from '../../auth/service/tokenService';

type Props = ProfileSetupScreenProps<typeof ProfileSetupRoutes.COMPLETE_PROFILE>;

/** Upload avatar and return the Cloudinary URL — called just before final submit */
async function uploadAvatarIfNeeded(localUri: string | null): Promise<string | null> {
  if (!localUri) return null;
  try {
    const token = await tokenService.getAccessToken();
    const formData = new FormData();
    formData.append('avatar', { uri: localUri, type: 'image/jpeg', name: 'avatar.jpg' } as any);
    const res = await fetch(`${BASE_URL}user/upload-avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const json = await res.json();
    return json.data?.avatarUrl ?? null;
  } catch {
    return null; // non-fatal — profile still completes without avatar
  }
}

const CompleteProfileScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<PersonalFormValues | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);   // local URI
  const [pickerVisible, setPickerVisible] = useState(false);

  const { mutate: completeProfile, isPending } = useCompleteProfile();

  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current;

  const advanceProgress = () => {
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: false,
    }).start();
  };

  const handleStep1 = (values: PersonalFormValues) => {
    setStep1Data(values);
    advanceProgress();
    setStep(2);
  };

  const handleStep2 = async (values: BodyFormValues) => {
    if (!step1Data) return;

    // Upload avatar to Cloudinary right before submitting
    const avatarUrl = await uploadAvatarIfNeeded(avatarUri);

    completeProfile(
      { ...step1Data, ...values, ...(avatarUrl ? { avatarUrl } : {}) },
      {
        onSuccess: res => {
          if (res.success) {
            toast.success('Profile completed! Welcome aboard 🎉');
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

  return (
    <Screen
      scroll
      safeArea={false}
      header={
        <AppView>
          <Header
            title={`Step ${step} of ${TOTAL_STEPS}`}
            onBackPress={() => setStep(s => s - 1)}
            showBack={step > 1}
            backLabel=""
          />
          <AppView style={[s.progressTrack, { backgroundColor: colors.secondary }]}>
            <AppView
              style={[
                s.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${(step / TOTAL_STEPS) * 100}%`,
                },
              ]}
            />
          </AppView>
        </AppView>
      }
    >
      <AppView style={s.form}>
        {step === 1 && (
          <Step1Personal
            onNext={handleStep1}
            colors={colors}
            avatarUri={avatarUri}
            onAvatarPress={() => setPickerVisible(true)}
          />
        )}
        {step === 2 && (
          <Step2Body
            onSubmit={handleStep2}
            loading={isPending}
            colors={colors}
          />
        )}
      </AppView>

      <AvatarPickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={uri => setAvatarUri(uri)}
      />
    </Screen>
  );
};

const s = StyleSheet.create({
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  form: { paddingTop: 8 },
});

export default CompleteProfileScreen;
