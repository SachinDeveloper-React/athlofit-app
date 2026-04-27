import React, { useRef, useState } from 'react';
import { TextInput, Animated } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../hooks/useTheme';
import { makeStyles } from '../../../hooks/makeStyles';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { useToast } from '../../../components/Toast';
import { forgotPasswordSchema, type ForgotPasswordFormValues } from '../utils/authValidation';
import { AuthRoutes } from '../../../navigation/routes';
import type { AuthStackScreenProps } from '../../../types/navigation.types';
import { Header, AppView, AppText, Button, Screen } from '../../../components';

type Props = AuthStackScreenProps<typeof AuthRoutes.FORGOT_PASSWORD>;

const useStyles = makeStyles(({ spacing, radius, fontSize, fontWeight }) => ({
  content:  { flex: 1 },
  hero:     { paddingTop: spacing[8], paddingBottom: spacing[2] },
  iconWrap: {
    width: 64, height: 64,
    borderRadius: radius.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing[5],
  },
  iconEmoji: { fontSize: fontSize['3xl'] },
  title: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
    marginBottom: spacing[2],
  },
  subtitle:  { fontSize: fontSize.base, lineHeight: 24, maxWidth: 320 },
  form:      { paddingTop: spacing[8] },
  label:     { fontSize: fontSize.md, fontWeight: fontWeight.medium, marginBottom: spacing[1] },
  inputBox:  {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    minHeight: 52,
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
  },
  input:     { flex: 1, fontSize: fontSize.base, paddingVertical: spacing[3] },
  errorText: { fontSize: fontSize.sm, marginTop: spacing[1] },
  infoCard:  {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
    marginTop: spacing[5],
    marginBottom: spacing[1],
  },
  infoIcon:  { fontSize: fontSize.base, lineHeight: 20 },
  infoText:  { flex: 1, fontSize: fontSize.sm, lineHeight: 19 },
  backToLogin: { alignItems: 'center' as const, marginTop: spacing[6] },
}));

const ForgotPasswordScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const { mutate: forgotPassword, isPending } = useForgotPassword();

  const { control, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
  };
  const onBlurAnim = () => {
    setFocused(false);
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      errors.email ? colors.destructive : colors.border,
      errors.email ? colors.destructive : colors.primary,
    ],
  });

  const onSubmit = ({ email }: ForgotPasswordFormValues) => {
    forgotPassword({ email }, {
      onSuccess: () => navigation.navigate(AuthRoutes.OTP, { email, flow: 'forgot_password' }),
      onError: (err: any) => toast.error(err?.message ?? 'Something went wrong.'),
    });
  };

  return (
    <Screen safeArea={false} scroll header={<Header backLabel="Back" showBack />}>
      <AppView style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AppView style={styles.hero}>
          <AppView style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
            <AppText style={styles.iconEmoji}>🔒</AppText>
          </AppView>
          <AppText style={[styles.title, { color: colors.foreground }]}>Forgot password?</AppText>
          <AppText style={[styles.subtitle, { color: colors.mutedForeground }]}>
            No worries. Enter your email and we'll send you a 6-digit reset code.
          </AppText>
        </AppView>

        <AppView style={styles.form}>
          <Controller control={control} name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <AppView>
                <AppText style={[styles.label, { color: errors.email ? colors.destructive : colors.foreground }]}>
                  Email address
                </AppText>
                <Animated.View style={[styles.inputBox, {
                  backgroundColor: colors.inputBackground,
                  borderColor,
                  borderWidth: focused ? 1.5 : 1,
                }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={value} onChangeText={onChange}
                    onFocus={onFocus}
                    onBlur={() => { onBlurAnim(); onBlur(); }}
                    keyboardType="email-address" autoCapitalize="none"
                    autoCorrect={false} returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    selectionColor={colors.primary} autoFocus
                  />
                </Animated.View>
                {!!errors.email && (
                  <AppText style={[styles.errorText, { color: colors.destructive }]}>
                    {errors.email.message}
                  </AppText>
                )}
              </AppView>
            )} />

          <AppView style={[styles.infoCard, {
            backgroundColor: colors.primary + '10',
            borderColor: colors.primary + '25',
          }]}>
            <AppText style={styles.infoIcon}>ℹ️</AppText>
            <AppText style={[styles.infoText, { color: colors.foreground }]}>
              Check your spam folder if you don't receive the email within a few minutes.
            </AppText>
          </AppView>

          <Button label="Send Reset Code" onPress={handleSubmit(onSubmit)}
            loading={isPending} fullWidth size="lg" style={{ marginTop: 20 }} />

          <Button fullWidth label="Remembered your password? Sign in"
            variant="ghost" size="sm" onPress={() => navigation.goBack()}
            style={styles.backToLogin}
            labelStyle={{ color: colors.mutedForeground }} />
        </AppView>
      </AppView>
    </Screen>
  );
};

export default ForgotPasswordScreen;
