import React, { useRef } from 'react';
import { Linking, TextInput } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../hooks/useTheme';
import { makeStyles } from '../../../hooks/makeStyles';
import { useRegister } from '../hooks/useRegister';
import { useToast } from '../../../components/Toast';
import { registerSchema, type RegisterFormValues } from '../utils/authValidation';
import { AuthRoutes } from '../../../navigation/routes';
import type { AuthStackScreenProps } from '../../../types/navigation.types';
import { Header, Input, AppView, AppText, Button, Screen } from '../../../components';
import { CONFIG } from '../../../config/appConfig';

type Props = AuthStackScreenProps<typeof AuthRoutes.SIGNUP>;



const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  hero:     { paddingTop: spacing[8], paddingBottom: spacing[1] },
  iconWrap: {
    width: 64, height: 64,
    borderRadius: radius.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing[5],
  },
  iconEmoji: { fontSize: fontSize['3xl'] },
  title: {
    fontSize: fontSize['5xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
    marginBottom: spacing[1],
  },
  subtitle:  { fontSize: fontSize.base, lineHeight: 22 },
  form:      { paddingTop: spacing[7] },
  rulesBox:  {
    borderRadius: radius.lg,
    padding: spacing[3],
    marginBottom: spacing[4],
    marginTop: -spacing[1],
  },
  rulesTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold, marginBottom: spacing[1] },
  rulesItem:  { fontSize: fontSize.sm, lineHeight: 20 },
  terms: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    textAlign: 'center' as const,
    marginBottom: spacing[5],
    marginTop: spacing[1],
  },
  footer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: spacing[7],
    paddingBottom: spacing[2],
  },
  footerText: { fontSize: fontSize.md },
}));

const SignupScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  const emailRef   = useRef<TextInput>(null);
  const passRef    = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const { mutate: register, isPending } = useRegister();

  const { control, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = (values: RegisterFormValues) => {
    register({ name: values.name, email: values.email, password: values.password }, {
      onError: (err: any) => toast.error(err?.message ?? 'Registration failed.'),
      onSuccess: () => navigation.navigate(AuthRoutes.OTP, { email: values.email, flow: 'signup' }),
    });
  };

  return (
    <Screen safeArea={false} scroll withBottomInset={false} header={<Header backLabel="Back" showBack />}>
      <AppView style={styles.hero}>
        <AppView style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
          <AppText style={styles.iconEmoji}>👤</AppText>
        </AppView>
        <AppText style={[styles.title, { color: colors.foreground }]}>Create account</AppText>
        <AppText style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Start your health journey today
        </AppText>
      </AppView>

      <AppView style={styles.form}>
        <Controller control={control} name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Full name" placeholder="John Doe" value={value}
              onChangeText={onChange} onBlur={onBlur} error={errors.name?.message}
              autoCapitalize="words" onSubmitEditing={() => emailRef.current?.focus()} />
          )} />

        <Controller control={control} name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Email" placeholder="you@example.com" value={value}
              onChangeText={onChange} onBlur={onBlur} error={errors.email?.message}
              keyboardType="email-address" onSubmitEditing={() => passRef.current?.focus()} />
          )} />

        <Controller control={control} name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Password" placeholder="Min 8 chars, 1 uppercase, 1 number"
              value={value} onChangeText={onChange} onBlur={onBlur}
              error={errors.password?.message} secureTextEntry
              onSubmitEditing={() => confirmRef.current?.focus()} />
          )} />

        <AppView style={[styles.rulesBox, { backgroundColor: colors.secondary }]}>
          <AppText style={[styles.rulesTitle, { color: colors.foreground }]}>Password must have:</AppText>
          <AppText style={[styles.rulesItem, { color: colors.mutedForeground }]}>• At least 8 characters</AppText>
          <AppText style={[styles.rulesItem, { color: colors.mutedForeground }]}>• One uppercase letter (A–Z)</AppText>
          <AppText style={[styles.rulesItem, { color: colors.mutedForeground }]}>• One number (0–9)</AppText>
        </AppView>

        <AppText style={[styles.terms, { color: colors.mutedForeground }]}>
          By creating an account you agree to our{' '}
          <AppText style={{ color: colors.primary }} onPress={() => Linking.openURL(CONFIG.TERMS_URL)}>Terms of Service</AppText> and{' '}
          <AppText style={{ color: colors.primary }} onPress={() => Linking.openURL(CONFIG.PRIVACY_URL)}>Privacy Policy</AppText>
        </AppText>

        <Button label="Create Account" onPress={handleSubmit(onSubmit)}
          loading={isPending} fullWidth size="lg" style={{ marginBottom: 12 }} />
      </AppView>

      <AppView style={styles.footer}>
        <AppText style={[styles.footerText, { color: colors.mutedForeground }]}>
          Already have an account?
        </AppText>
        <Button label="Sign in" variant="ghost" size="sm" onPress={() => navigation.goBack()}
          labelStyle={{ color: colors.primary, fontWeight: '600' }} />
      </AppView>
    </Screen>
  );
};

export default SignupScreen;
