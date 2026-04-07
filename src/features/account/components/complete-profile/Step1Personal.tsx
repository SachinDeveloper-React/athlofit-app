import { Controller, useForm } from 'react-hook-form';
import { Step1Props } from '../../types/completeProfile.types';
import {
  PersonalFormValues,
  personalSchema,
} from '../../utils/profileSetup.validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { AppView, AppText, Button } from '../../../../components';
import { Field } from './Field';
import { DateField } from './DateField';
import { GENDER_OPTIONS } from '../../constants/completeProfile.constant';

export const Step1Personal: React.FC<Step1Props> = ({ onNext, colors }) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<PersonalFormValues>({
    resolver: zodResolver(personalSchema),
    defaultValues: { phone: '', dob: '', gender: undefined },
  });

  return (
    <AppView style={g.stepContent}>
      <AppView
        style={[g.stepIconWrap, { backgroundColor: colors.primary + '15' }]}
      >
        <AppText style={g.stepIcon}>👤</AppText>
      </AppView>
      <AppText style={[g.stepTitle, { color: colors.foreground }]}>
        Personal info
      </AppText>
      <AppText style={[g.stepSubtitle, { color: colors.mutedForeground }]}>
        Tell us a bit about yourself
      </AppText>

      {/* Phone */}
      <Controller
        control={control}
        name="phone"
        render={({ field: { onChange, onBlur, value } }) => (
          <Field
            label="Phone number"
            placeholder="+91 98765 43210"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.phone?.message}
            keyboardType="phone-pad"
            hint="We'll use this for account recovery"
          />
        )}
      />

      {/* DOB */}
      <Controller
        control={control}
        name="dob"
        render={({ field: { onChange, value } }) => (
          <DateField
            value={value}
            onChange={onChange}
            error={errors.dob?.message}
          />
        )}
      />

      {/* Gender */}
      <Controller
        control={control}
        name="gender"
        render={({ field: { value, onChange } }) => (
          <AppView style={{ marginBottom: 16 }}>
            <AppText
              style={[
                {
                  fontSize: 14,
                  fontWeight: '500',
                  marginBottom: 4,
                  color: errors.gender ? colors.destructive : colors.foreground,
                },
              ]}
            >
              Gender
            </AppText>
            <AppView style={g.row}>
              {GENDER_OPTIONS.map(opt => {
                const selected = value === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => onChange(opt.value)}
                    style={[
                      g.btn,
                      {
                        backgroundColor: selected
                          ? colors.primary + '15'
                          : colors.inputBackground,
                        borderColor: selected ? colors.primary : colors.border,
                        borderWidth: selected ? 1.5 : 1,
                      },
                    ]}
                  >
                    <AppText style={g.emoji}>{opt.emoji}</AppText>
                    <AppText
                      style={[
                        g.label,
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
            {!!errors.gender && (
              <AppText style={[g.errorText, { color: colors.destructive }]}>
                {errors.gender.message}
              </AppText>
            )}
          </AppView>
        )}
      />

      <Button
        label="Continue →"
        onPress={handleSubmit(onNext)}
        size="lg"
        fullWidth
        style={{ marginTop: 8 }}
      />
    </AppView>
  );
};

const g = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 12 },
  emoji: { fontSize: 20, marginBottom: 4 },
  label: { fontSize: 13 },
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
});
