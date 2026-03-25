import { Controller, useForm } from 'react-hook-form';
import { Step1Props } from '../../types/completeProfile.types';
import {
  PersonalFormValues,
  personalSchema,
} from '../../utils/profileSetup.validation';
import { zodResolver } from '@hookform/resolvers/zod';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    <View style={g.stepContent}>
      <View
        style={[g.stepIconWrap, { backgroundColor: colors.primary + '15' }]}
      >
        <Text style={g.stepIcon}>👤</Text>
      </View>
      <Text style={[g.stepTitle, { color: colors.foreground }]}>
        Personal info
      </Text>
      <Text style={[g.stepSubtitle, { color: colors.mutedForeground }]}>
        Tell us a bit about yourself
      </Text>

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
          <View style={{ marginBottom: 16 }}>
            <Text
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
            </Text>
            <View style={g.row}>
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
                    <Text style={g.emoji}>{opt.emoji}</Text>
                    <Text
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
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!errors.gender && (
              <Text style={[g.errorText, { color: colors.destructive }]}>
                {errors.gender.message}
              </Text>
            )}
          </View>
        )}
      />

      <TouchableOpacity
        onPress={handleSubmit(onNext)}
        activeOpacity={0.8}
        style={[g.nextBtn, { backgroundColor: colors.primary }]}
      >
        <Text style={g.nextBtnText}>Continue</Text>
        <Text style={g.nextBtnArrow}>→</Text>
      </TouchableOpacity>
    </View>
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
  errorText: { fontSize: 12, marginTop: 4 },
});
