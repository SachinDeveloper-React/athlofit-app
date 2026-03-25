import React, { useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../../hooks/useTheme';
import { useRegister } from '../hooks/useRegister';
import { useToast } from '../../../components/Toast';
import {
  registerSchema,
  type RegisterFormValues,
} from '../utils/authValidation';
import { AuthRoutes } from '../../../navigation/routes';
import type { AuthStackScreenProps } from '../../../types/navigation.types';
import { Header, Input } from '../../../components';

type Props = AuthStackScreenProps<typeof AuthRoutes.SIGNUP>;

const SignupScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const toast = useToast();

  const emailRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const { mutate: register, isPending } = useRegister();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: 'Sachin Chaurasiya',
      email: 'sachinkumarq870@gmail.com',
      password: 'Sachu_@#8700',
    },
  });

  const onSubmit = (values: RegisterFormValues) => {
    register(
      {
        name: values.name,
        email: values.email,
        password: values.password,
      },
      {
        onError: (err: any) =>
          toast.error(err?.message ?? 'Registration failed. Please try again.'),
        onSuccess: () => {
          navigation.navigate(AuthRoutes.OTP, {
            email: values.email,
            flow: 'signup',
          });
        },
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[s.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Header backLabel="Back" showBack />
      {/* ── Nav bar ── */}
      {/* <View
        style={[
          s.navbar,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[s.backText, { color: colors.primary }]}>‹ Back</Text>
        </TouchableOpacity>
      </View> */}

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={s.hero}>
          <View
            style={[s.iconWrap, { backgroundColor: colors.primary + '15' }]}
          >
            <Text style={s.iconEmoji}>👤</Text>
          </View>
          <Text style={[s.title, { color: colors.foreground }]}>
            Create account
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Start your health journey today
          </Text>
        </View>

        {/* ── Form ── */}
        <View style={s.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Full name"
                placeholder="John Doe"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                autoCapitalize="words"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                // ref={emailRef}
                label="Email"
                placeholder="you@example.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                keyboardType="email-address"
                onSubmitEditing={() => passRef.current?.focus()}
              />
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                // ref={passRef}
                label="Password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                secureTextEntry
                onSubmitEditing={() => confirmRef.current?.focus()}
              />
            )}
          />

          {/* ── Password rules hint ── */}
          <View style={[s.rulesBox, { backgroundColor: colors.secondary }]}>
            <Text style={[s.rulesTitle, { color: colors.foreground }]}>
              Password must have:
            </Text>
            <Text style={[s.rulesItem, { color: colors.mutedForeground }]}>
              • At least 8 characters
            </Text>
            <Text style={[s.rulesItem, { color: colors.mutedForeground }]}>
              • One uppercase letter (A–Z)
            </Text>
            <Text style={[s.rulesItem, { color: colors.mutedForeground }]}>
              • One number (0–9)
            </Text>
          </View>

          {/* ── Terms ── */}
          <Text style={[s.terms, { color: colors.mutedForeground }]}>
            By creating an account you agree to our{' '}
            <Text style={{ color: colors.primary }}>Terms of Service</Text> and{' '}
            <Text style={{ color: colors.primary }}>Privacy Policy</Text>
          </Text>

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
              <Text style={s.submitLabel}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <Text style={[s.footerText, { color: colors.mutedForeground }]}>
            Already have an account?
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[s.footerLink, { color: colors.primary }]}>
              {' '}
              Sign in
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  scroll: { flexGrow: 1 },
  hero: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 4 },
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
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: { fontSize: 16, lineHeight: 22 },
  form: { paddingHorizontal: 24, paddingTop: 28 },
  rulesBox: { borderRadius: 10, padding: 14, marginBottom: 16, marginTop: -4 },
  rulesTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  rulesItem: { fontSize: 12, lineHeight: 20 },
  terms: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 28,
    paddingBottom: 8,
  },
  footerText: { fontSize: 15 },
  footerLink: { fontSize: 15, fontWeight: '600' },
});

export default SignupScreen;
