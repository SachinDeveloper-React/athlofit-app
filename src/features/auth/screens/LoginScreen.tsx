import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Alert, Linking, TouchableOpacity } from 'react-native';
import { AuthStackScreenProps } from '../../../types/navigation.types';
import { AuthRoutes } from '../../../navigation/routes';
import { useTheme } from '../../../hooks/useTheme';
import { makeStyles } from '../../../hooks/makeStyles';
import {
  AppText, AppView, Button, Divider, Icon, Input, Screen, useToast,
} from '../../../components';
import { useLogin } from '../hooks/useLogin';
import { useGoogleLogin } from '../hooks/useGoogleLogin';
import { LoginFormValues, loginSchema } from '../utils/authValidation';
import { CONFIG } from '../../../config/appConfig';

type Props = AuthStackScreenProps<typeof AuthRoutes.LOGIN>;



const useStyles = makeStyles(({ colors, spacing, radius }) => ({
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
  checkboxRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent:"center" as const,
    marginBottom: spacing[4],
    // marginTop: spacing[2],
  },
  checkboxBox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: spacing[2],
    marginTop: -1,
  },
  checkboxLabel: {
    flex: 1,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
}));

const LoginScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  const { mutate: login, isPending } = useLogin();
  const { mutate: googleLogin, isPending: isGooglePending } = useGoogleLogin();

  const { control, handleSubmit, watch, formState: { errors }, setError } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', termsAccepted: false },
  });

  const termsAccepted = watch('termsAccepted');

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
        // If account is already logged in on another device
        if (err?.statusCode === 409 && err?.data?.activeSession) {
          Alert.alert(
            'Already Logged In',
            'Your account is active on another device. Do you want to log out from that device and continue here?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Continue Here',
                style: 'destructive',
                onPress: () => {
                  login({ ...values, forceLogin: true }, {
                    onError: (retryErr: any) => {
                      toast.error(retryErr?.message ?? 'Login failed. Please try again.');
                    },
                  });
                },
              },
            ],
          );
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

        <AppView row justify="flex-end" mb={2} style={{ marginTop: -8 }}>
          <Button label="Forgot password?" variant="ghost" size="sm"
            onPress={() => navigation.navigate(AuthRoutes.FORGOT_PASSWORD)}
            labelStyle={{ color: colors.primary }} />
        </AppView>

        {/* Terms & Conditions Checkbox */}
        <Controller
          control={control}
          name="termsAccepted"
          render={({ field: { onChange, value } }) => (
            <AppView>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onChange(!value)}
                style={styles.checkboxRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: value === true }}
                accessibilityLabel="Accept Terms and Conditions and Privacy Policy"
              >
                <AppView
                  style={[
                    styles.checkboxBox,
                    {
                      borderColor: errors.termsAccepted ? colors.destructive : (value ? colors.primary : colors.border),
                      backgroundColor: value ? colors.primary : 'transparent',
                    },
                  ]}
                >
                  {value && <Icon name="Check" size={14} color="#FFFFFF" strokeWidth={3} />}
                </AppView>

                <AppView style={styles.checkboxLabel}>
                  <AppText variant="footnote">
                    I agree to the{' '}
                  </AppText>
                  <AppText
                    variant="footnote"
                    style={{ color: colors.primary, textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL(CONFIG.TERMS_URL)}
                  >
                    Terms & Conditions
                  </AppText>
                  <AppText variant="footnote"> and </AppText>
                  <AppText
                    variant="footnote"
                    style={{ color: colors.primary, textDecorationLine: 'underline' }}
                    onPress={() => Linking.openURL(CONFIG.PRIVACY_URL)}
                  >
                    Privacy Policy
                  </AppText>
                </AppView>
              </TouchableOpacity>
              {errors.termsAccepted && (
                <AppText variant="caption1" style={{ color: colors.destructive, marginTop: -8, marginBottom: 8 }}>
                  {errors.termsAccepted.message}
                </AppText>
              )}
            </AppView>
          )}
        />

        <Button label="Sign In" onPress={handleSubmit(onSubmit)} loading={isPending} fullWidth size="lg" />
        <Divider label="or" my={6} />
        <Button
          label={isGooglePending ? 'Signing in...' : 'Continue with Google'}
          variant="outline"
          onPress={() => {
            if (!termsAccepted) {
              setError('termsAccepted', {
                message: 'You must accept Terms & Conditions and Privacy Policy',
              });
              toast.error('Please accept Terms & Conditions and Privacy Policy to continue.');
              return;
            }
            googleLogin({ termsAccepted: true }, {
              onError: (err: any) => {
                if (err?.statusCode === 409 && err?.data?.activeSession) {
                  Alert.alert(
                    'Already Logged In',
                    'Your account is active on another device. Do you want to log out from that device and continue here?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Continue Here',
                        style: 'destructive',
                        onPress: () => {
                          googleLogin({ termsAccepted: true, forceLogin: true }, {
                            onError: (retryErr: any) => {
                              toast.error(retryErr?.message ?? 'Google sign-in failed. Please try again.');
                            },
                          });
                        },
                      },
                    ],
                  );
                  return;
                }
                console.log("err?.message", err?.message);
                
                toast.error(err?.message ?? 'Google sign-in failed.');
              },
            });
          }}
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

