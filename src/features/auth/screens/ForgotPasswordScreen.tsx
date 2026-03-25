import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../hooks/useTheme';
import { useForgotPassword } from '../hooks/useForgotPassword';
import { useToast } from '../../../components/Toast';
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from '../utils/authValidation';
import { AuthRoutes } from '../../../navigation/routes';
import type { AuthStackScreenProps } from '../../../types/navigation.types';
import { Header } from '../../../components';

type Props = AuthStackScreenProps<typeof AuthRoutes.FORGOT_PASSWORD>;

// ─── Screen ───────────────────────────────────────────────────────────────────

const ForgotPasswordScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  // Animated focus state for email input
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const { mutate: forgotPassword, isPending } = useForgotPassword();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onFocus = () => {
    setFocused(true);
    Animated.timing(anim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };
  const onBlurAnim = () => {
    setFocused(false);
    Animated.timing(anim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      errors.email ? colors.destructive : colors.border,
      errors.email ? colors.destructive : colors.primary,
    ],
  });

  const onSubmit = ({ email }: ForgotPasswordFormValues) => {
    forgotPassword(
      { email },
      {
        onSuccess: () => {
          navigation.navigate(AuthRoutes.OTP, {
            email,
            flow: 'forgot_password',
          });
        },
        onError: (err: any) =>
          toast.error(
            err?.message ?? 'Something went wrong. Please try again.',
          ),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header showBack />

      {/* ── Content ── */}
      <View style={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View
            style={[s.iconWrap, { backgroundColor: colors.primary + '15' }]}
          >
            <Text style={s.iconEmoji}>🔒</Text>
          </View>

          <Text style={[s.title, { color: colors.foreground }]}>
            Forgot password?
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            No worries. Enter your email and we'll send you a 6-digit reset
            code.
          </Text>
        </View>

        {/* ── Email field ── */}
        <View style={s.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <View>
                <Text
                  style={[
                    s.label,
                    {
                      color: errors.email
                        ? colors.destructive
                        : colors.foreground,
                    },
                  ]}
                >
                  Email address
                </Text>

                <Animated.View
                  style={[
                    s.inputBox,
                    {
                      backgroundColor: colors.inputBackground,
                      borderColor,
                      borderWidth: focused ? 1.5 : 1,
                    },
                  ]}
                >
                  <TextInput
                    style={[s.input, { color: colors.foreground }]}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={value}
                    onChangeText={onChange}
                    onFocus={onFocus}
                    onBlur={() => {
                      onBlurAnim();
                      onBlur();
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit(onSubmit)}
                    selectionColor={colors.primary}
                    autoFocus
                  />
                </Animated.View>

                {!!errors.email && (
                  <Text style={[s.errorText, { color: colors.destructive }]}>
                    {errors.email.message}
                  </Text>
                )}
              </View>
            )}
          />

          {/* ── Info card ── */}
          <View
            style={[
              s.infoCard,
              {
                backgroundColor: colors.primary + '10',
                borderColor: colors.primary + '25',
              },
            ]}
          >
            <Text style={[s.infoIcon]}>ℹ️</Text>
            <Text style={[s.infoText, { color: colors.foreground }]}>
              Check your spam folder if you don't receive the email within a few
              minutes.
            </Text>
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            onPress={handleSubmit(onSubmit)}
            disabled={isPending}
            activeOpacity={0.8}
            style={[
              s.submitBtn,
              { backgroundColor: colors.primary, opacity: isPending ? 0.7 : 1 },
            ]}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.submitLabel}>Send Reset Code</Text>
            )}
          </TouchableOpacity>

          {/* ── Back to login ── */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={s.backToLogin}
            activeOpacity={0.7}
          >
            <Text
              style={[s.backToLoginText, { color: colors.mutedForeground }]}
            >
              Remembered your password?{' '}
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                Sign in
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  flex: { flex: 1 },
  navbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backText: { fontSize: 17, fontWeight: '400' },
  content: { flex: 1, paddingHorizontal: 24 },
  hero: { paddingTop: 36, paddingBottom: 8 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconEmoji: { fontSize: 30 },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  subtitle: { fontSize: 16, lineHeight: 24, maxWidth: 320 },
  form: { paddingTop: 32 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 6 },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 14 },
  errorText: { fontSize: 12, marginTop: 4 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 20,
    marginBottom: 4,
  },
  infoIcon: { fontSize: 16, lineHeight: 20 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  backToLogin: { alignItems: 'center', marginTop: 24 },
  backToLoginText: { fontSize: 15, textAlign: 'center' },
});

export default ForgotPasswordScreen;
