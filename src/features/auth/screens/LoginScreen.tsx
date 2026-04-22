import React from 'react';
import {
  StyleSheet,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AuthStackScreenProps } from '../../../types/navigation.types';
import { AuthRoutes } from '../../../navigation/routes';
import { useTheme } from '../../../hooks/useTheme';
import {
  AppText,
  AppView,
  Button,
  Divider,
  Input,
  Screen,
  useToast,
} from '../../../components';
import { useLogin } from '../hooks/useLogin';
import { useGoogleLogin } from '../hooks/useGoogleLogin';
import { LoginFormValues, loginSchema } from '../utils/authValidation';

type Props = AuthStackScreenProps<typeof AuthRoutes.LOGIN>;

const LoginScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  const { mutate: login, isPending } = useLogin();
  const { mutate: googleLogin, isPending: isGooglePending } = useGoogleLogin();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'sachinkumarq870@gmail.com',
      password: 'Sachu_@#8700',
    },
  });

  const onSubmit = (values: LoginFormValues) => {
    login(values, {
      onError: (err: any) =>
        toast.error(err?.message ?? 'Login failed. Please try again.'),
    });
  };

  return (
    <Screen safeArea={false} scroll>


      <AppView style={[styles.hero, { paddingTop: insets.top + 40 }]}>
        <AppView
          style={[styles.logoBox, { backgroundColor: colors.primary + '18' }]}
        >
          {/* Replace with your logo SVG / Image */}
          <AppText variant="title1">❤️</AppText>
        </AppView>
        <AppText variant="largeTitle" weight="bold" style={styles.title}>
          Welcome back
        </AppText>
        <AppText variant="callout" align="center">
          Sign in to continue tracking your health
        </AppText>
      </AppView>

      {/* ── Form ── */}
      <AppView px={5} mt={8}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Email"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.email?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Password"
              placeholder="••••••••"
              isPassword
              returnKeyType="done"
              onSubmitEditing={handleSubmit(onSubmit)}
              onChangeText={onChange}
              onBlur={onBlur}
              value={value}
              error={errors.password?.message}
            />
          )}
        />

        {/* Forgot password */}
        <AppView row justify="flex-end" mb={6} style={{ marginTop: -8 }}>
          <Button
            label="Forgot password?"
            variant="ghost"
            size="sm"
            onPress={() => navigation.navigate(AuthRoutes.FORGOT_PASSWORD)}
            labelStyle={{ color: colors.primary }}
          />
        </AppView>

        <Button
          label="Sign In"
          onPress={handleSubmit(onSubmit)}
          loading={isPending}
          fullWidth
          size="lg"
        />

        <Divider label="or" my={6} />

        {/* Social buttons placeholder */}
        <Button
          label="Continue with Apple"
          variant="secondary"
          onPress={() => { }}
          fullWidth
          size="lg"
          style={styles.socialBtn}
        />

        <Button
          label={isGooglePending ? 'Signing in...' : 'Continue with Google'}
          variant="outline"
          onPress={() =>
            googleLogin(undefined, {
              onError: (err: any) =>
                toast.error(err?.message ?? 'Google sign-in failed. Please try again.'),
            })
          }
          loading={isGooglePending}
          fullWidth
          size="lg"
        />
      </AppView>

      {/* ── Footer ── */}
      <AppView row center mt={8} gap={1}>
        <AppText variant="subhead" secondary>
          Don't have an account?
        </AppText>
        <Button
          label="Sign up"
          variant="ghost"
          size="sm"
          onPress={() => navigation.navigate(AuthRoutes.SIGNUP)}
          labelStyle={{ color: colors.primary, fontWeight: '600' }}
        />
      </AppView>

    </Screen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  hero: { alignItems: 'center', paddingHorizontal: 24 },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: { marginBottom: 8, marginTop: 4 },
  socialBtn: { marginBottom: 12 },
});

export default LoginScreen;
