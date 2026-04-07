import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import {
  AppText,
  Screen,
  AppView,
  Header,
  Button,
  Avatar,
  Icon,
  useToast,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useAuthStore } from '../../auth/store/authStore';
import { useEditProfile } from '../hooks/useEditProfile';
import {
  editProfileSchema,
  EditProfileFormValues,
} from '../utils/profileSetup.validation';
import { Field } from '../components/complete-profile/Field';
import { DateField } from '../components/complete-profile/DateField';
import {
  GENDER_OPTIONS,
  BLOOD_TYPES,
} from '../constants/completeProfile.constant';
import { PickerSheet } from '../components/complete-profile/PickerSheet';
import { NumericStepper } from '../components/complete-profile/NumericStepper';

const EditProfileScreen: React.FC = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const toast = useToast();
  const user = useAuthStore(s => s.user);

  const { mutate: updateProfile, isPending } = useEditProfile();

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      dob: user?.dob || '',
      gender: user?.gender || 'M',
      height: user?.height || 170,
      weight: user?.weight || 70,
      bloodType: user?.bloodType || 'O+',
    },
  });

  const [bloodTypePickerVisible, setBloodTypePickerVisible] =
    React.useState(false);

  const onSubmit = (values: EditProfileFormValues) => {
    updateProfile(values, {
      onSuccess: () => {
        toast.success('Profile updated successfully! ✨');
        navigation.goBack();
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to update profile');
      },
    });
  };

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Edit Profile" showBack backLabel="" />}
    >
      {/* Avatar Section */}
      <AppView center style={styles.avatarSection}>
        <AppView style={styles.avatarWrapper}>
          <Avatar
            uri={user?.avatarUrl || undefined}
            name={user?.name}
            size="2xl"
            style={{ width: 110, height: 110, borderRadius: 55 }}
          />
          <TouchableOpacity
            style={[styles.editBadge, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <Icon name="Camera" size={20} color="#fff" />
          </TouchableOpacity>
        </AppView>
        <AppText variant="subhead" style={styles.avatarHint}>
          Tap to change photo
        </AppText>
      </AppView>

      {/* Form Sections */}
      <AppView style={styles.form}>
            <AppView style={styles.section}>
              <AppText variant="overline" style={styles.sectionTitle}>
                Account Information
              </AppText>

              <Field
                label="Email Address"
                placeholder="email@example.com"
                value={user?.email || ''}
                onChangeText={() => {}}
                onBlur={() => {}}
                isVerified={user?.emailVerified}
              />
              
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Full Name"
                    placeholder="e.g. John Doe"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.name?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="phone"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    label="Phone Number"
                    placeholder="+91 98765 43210"
                    value={value || ''}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.phone?.message}
                    keyboardType="phone-pad"
                    isVerified={user?.phoneVerified}
                  />
                )}
              />
            </AppView>

        <AppView style={styles.section}>
          <AppText variant="overline" style={styles.sectionTitle}>
            Health & Bio
          </AppText>

          <Controller
            control={control}
            name="dob"
            render={({ field: { onChange, value } }) => (
              <DateField
                value={value || ''}
                onChange={onChange}
                error={errors.dob?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="gender"
            render={({ field: { value, onChange } }) => (
              <AppView style={styles.fieldGroup}>
                <AppText
                  style={[styles.fieldLabel, { color: colors.foreground }]}
                >
                  Gender
                </AppText>
                <AppView style={styles.genderRow}>
                  {GENDER_OPTIONS.map(opt => {
                    const selected = value === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => onChange(opt.value)}
                        style={[
                          styles.genderBtn,
                          {
                            backgroundColor: selected
                              ? colors.primary + '15'
                              : colors.inputBackground,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                            borderWidth: selected ? 1.5 : 1,
                          },
                        ]}
                      >
                        <AppText style={styles.genderEmoji}>
                          {opt.emoji}
                        </AppText>
                        <AppText
                          style={[
                            styles.genderLabel,
                            {
                              color: selected
                                ? colors.primary
                                : colors.mutedForeground,
                              fontWeight: selected ? '600' : '400',
                            },
                          ]}
                        >
                          {opt.label}
                        </AppText>
                      </TouchableOpacity>
                    );
                  })}
                </AppView>
              </AppView>
            )}
          />

          <Controller
            control={control}
            name="bloodType"
            render={({ field: { value, onChange } }) => (
              <>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setBloodTypePickerVisible(true)}
                >
                  <AppView style={styles.fieldGroup}>
                    <AppText
                      style={[styles.fieldLabel, { color: colors.foreground }]}
                    >
                      Blood Type
                    </AppText>
                    <AppView
                      style={[
                        styles.pseudoInput,
                        {
                          backgroundColor: colors.inputBackground,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <AppText
                        style={{
                          color: value
                            ? colors.foreground
                            : colors.mutedForeground,
                        }}
                      >
                        {value || 'Choose blood type'}
                      </AppText>
                      <Icon
                        name="ChevronDown"
                        size={20}
                        color={colors.mutedForeground}
                      />
                    </AppView>
                  </AppView>
                </TouchableOpacity>
                <PickerSheet
                  title="Select Blood Type"
                  visible={bloodTypePickerVisible}
                  onClose={() => setBloodTypePickerVisible(false)}
                  options={BLOOD_TYPES}
                  selected={value || ''}
                  onSelect={onChange}
                />
              </>
            )}
          />
        </AppView>

        <AppView style={styles.section}>
          <AppText variant="overline" style={styles.sectionTitle}>
            Body Metrics
          </AppText>

          <AppView style={styles.metricsRow}>
            <AppView style={styles.flex}>
              <Controller
                control={control}
                name="height"
                render={({ field: { value, onChange } }) => (
                  <NumericStepper
                    label="Height"
                    unit="cm"
                    value={value}
                    onChange={onChange}
                    min={50}
                    max={250}
                    step={1}
                  />
                )}
              />
            </AppView>
            <AppView style={{ width: 16 }} />
            <AppView style={styles.flex}>
              <Controller
                control={control}
                name="weight"
                render={({ field: { value, onChange } }) => (
                  <NumericStepper
                    label="Weight"
                    unit="kg"
                    value={value}
                    onChange={onChange}
                    min={20}
                    max={300}
                    step={0.5}
                  />
                )}
              />
            </AppView>
          </AppView>
        </AppView>
      </AppView>

      <AppView
        style={[
          styles.footer,
          {
            // paddingBottom: insets.bottom + 16,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Button
          label="Save Changes"
          onPress={handleSubmit(onSubmit)}
          loading={isPending}
          disabled={!isDirty}
          size="lg"
          fullWidth
        />
      </AppView>
    </Screen>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  avatarSection: { marginVertical: 24 },
  avatarWrapper: { position: 'relative' },
  editBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarHint: { marginTop: 12, opacity: 0.6 },
  form: { gap: 24 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.5,
    marginBottom: 4,
  },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  genderEmoji: { fontSize: 20, marginBottom: 4 },
  genderLabel: { fontSize: 13 },
  pseudoInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricsRow: { flexDirection: 'row', alignItems: 'flex-start' },
  footer: {},
});
