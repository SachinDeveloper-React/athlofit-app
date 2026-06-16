import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthStackScreenProps } from '../../../types/navigation.types';
import { AuthRoutes } from '../../../navigation/routes';
import { useTheme } from '../../../hooks/useTheme';
import { makeStyles } from '../../../hooks/makeStyles';
import {
  AppText, AppView, Button, Divider, Input, Screen, useToast,
} from '../../../components';
import { useLogin } from '../hooks/useLogin';
import { useGoogleLogin } from '../hooks/useGoogleLogin';
import { LoginFormValues, loginSchema } from '../utils/authValidation';

type Props = AuthStackScreenProps<typeof AuthRoutes.LOGIN>;

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  hero:    { alignItems: 'center' as const },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing[6],
  },
  title:   { marginBottom: spacing[2], marginTop: spacing[1] },
}));

const LoginScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  const { mutate: login, isPending } = useLogin();
  const { mutate: googleLogin, isPending: isGooglePending } = useGoogleLogin();

  const { control, handleSubmit, formState: { errors } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormValues) => {
    login(values, {
      onError: (err: any) => {
        // If user's email is not verified, navigate to OTP screen
        if (err?.statusCode === 403 && err?.data?.emailNotVerified) {
          toast.info('Please verify your email to continue.');
          navigation.navigate(AuthRoutes.OTP, {
            email: err.data.email || values.email,
            flow: 'signup',
          });
          return;
        }
        toast.error(err?.message ?? 'Login failed. Please try again.');
      },
    });
  };

  return (
    <Screen safeArea={false} scroll withBottomInset={false}>
      <AppView style={[styles.hero, { paddingTop: insets.top + 40 }]}>
        <AppView style={[styles.logoBox, { backgroundColor: colors.primary + '18' }]}>
          <AppText variant="title1">❤️</AppText>
        </AppView>
        <AppText variant="largeTitle" weight="bold" style={styles.title}>
          Welcome back
        </AppText>
        <AppText variant="callout" align="center">
          Sign in to continue tracking your health
        </AppText>
      </AppView>

      <AppView mt={8}>
        <Controller control={control} name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Email" placeholder="you@example.com" keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} returnKeyType="next"
              onChangeText={onChange} onBlur={onBlur} value={value} error={errors.email?.message} />
          )} />

        <Controller control={control} name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Password" placeholder="••••••••" isPassword returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              onChangeText={onChange} onBlur={onBlur} value={value} error={errors.password?.message} />
          )} />

        <AppView row justify="flex-end" mb={6} style={{ marginTop: -8 }}>
          <Button label="Forgot password?" variant="ghost" size="sm"
            onPress={() => navigation.navigate(AuthRoutes.FORGOT_PASSWORD)}
            labelStyle={{ color: colors.primary }} />
        </AppView>

        <Button label="Sign In" onPress={handleSubmit(onSubmit)} loading={isPending} fullWidth size="lg" />
        <Divider label="or" my={6} />
        <Button
          label={isGooglePending ? 'Signing in...' : 'Continue with Google'}
          variant="outline"
          onPress={() => googleLogin(undefined, {
            onError: (err: any) => toast.error(err?.message ?? 'Google sign-in failed.'),
          })}
          loading={isGooglePending} fullWidth size="lg" />
      </AppView>

      <AppView row center mt={8} gap={1}>
        <AppText variant="subhead" secondary>Don't have an account?</AppText>
        <Button label="Sign up" variant="ghost" size="sm"
          onPress={() => navigation.navigate(AuthRoutes.SIGNUP)}
          labelStyle={{ color: colors.primary, fontWeight: '600' }} />
      </AppView>
    </Screen>
  );
};

export default LoginScreen;
