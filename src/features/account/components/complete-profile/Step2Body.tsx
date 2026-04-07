import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AppView, AppText, Button } from '../../../../components';
import { Step2Props } from '../../types/completeProfile.types';
import { Controller, useForm } from 'react-hook-form';
import { NumericStepper } from './NumericStepper';
import { PickerSheet } from './PickerSheet';
import { useState } from 'react';
import {
  BodyFormValues,
  bodySchema,
} from '../../utils/profileSetup.validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { BLOOD_TYPES } from '../../constants/completeProfile.constant';

export const Step2Body: React.FC<Step2Props> = ({
  onSubmit,
  loading,
  colors,
}) => {
  const [showBloodPicker, setShowBloodPicker] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<BodyFormValues>({
    resolver: zodResolver(bodySchema),
    defaultValues: { height: undefined, weight: undefined, bloodType: '' },
  });

  const bloodType = watch('bloodType');

  return (
    <AppView style={s.stepContent}>
      <AppView
        style={[s.stepIconWrap, { backgroundColor: colors.primary + '15' }]}
      >
        <AppText style={s.stepIcon}>📏</AppText>
      </AppView>
      <AppText style={[s.stepTitle, { color: colors.foreground }]}>
        Body metrics
      </AppText>
      <AppText style={[s.stepSubtitle, { color: colors.mutedForeground }]}>
        Used to calculate personalised health goals
      </AppText>

      {/* Height */}
      <Controller
        control={control}
        name="height"
        render={({ field: { value, onChange } }) => (
          <NumericStepper
            label="Height"
            unit="cm"
            value={value}
            onChange={onChange}
            error={errors.height?.message}
            min={50}
            max={300}
            step={1}
          />
        )}
      />

      {/* Weight */}
      <Controller
        control={control}
        name="weight"
        render={({ field: { value, onChange } }) => (
          <NumericStepper
            label="Weight"
            unit="kg"
            value={value}
            onChange={onChange}
            error={errors.weight?.message}
            min={10}
            max={500}
            step={0.5}
          />
        )}
      />

      {/* Blood type */}
      <AppView style={{ marginBottom: 24 }}>
        <AppText
          style={[
            {
              fontSize: 14,
              fontWeight: '500',
              marginBottom: 4,
              color: errors.bloodType ? colors.destructive : colors.foreground,
            },
          ]}
        >
          Blood type
        </AppText>
        <TouchableOpacity
          onPress={() => setShowBloodPicker(true)}
          style={[
            s.box,
            {
              backgroundColor: colors.inputBackground,
              borderColor: errors.bloodType
                ? colors.destructive
                : bloodType
                ? colors.primary
                : colors.border,
              borderWidth: bloodType ? 1.5 : 1,
            },
          ]}
        >
          <AppText
            style={{
              flex: 1,
              fontSize: 16,
              color: bloodType ? colors.foreground : colors.mutedForeground,
            }}
          >
            {bloodType || 'Select blood type'}
          </AppText>
          <AppText style={{ color: colors.mutedForeground }}>⌄</AppText>
        </TouchableOpacity>
        {!!errors.bloodType && (
          <AppText style={[s.errorText, { color: colors.destructive }]}>
            {errors.bloodType.message}
          </AppText>
        )}
      </AppView>

      <PickerSheet
        visible={showBloodPicker}
        onClose={() => setShowBloodPicker(false)}
        title="Select blood type"
        options={BLOOD_TYPES}
        selected={bloodType}
        onSelect={v => setValue('bloodType', v, { shouldValidate: true })}
      />

      <Button
        label="Complete Profile ✓"
        onPress={handleSubmit(onSubmit)}
        loading={loading}
        size="lg"
        fullWidth
        style={{ marginTop: 8 }}
      />
    </AppView>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
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
  errorText: { fontSize: 12, marginTop: 4 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
});
