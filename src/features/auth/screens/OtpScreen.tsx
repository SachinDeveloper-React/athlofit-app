import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  TextInput,
  StyleSheet,
  Animated,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import { useToast } from '../../../components/Toast';
import { AppView, AppText, Button, Loader, Screen, Header } from '../../../components';
import { useVerifyOtp, useResendOtp } from '../hooks/useOtp';
import { AuthRoutes } from '../../../navigation/routes';
import type { AuthStackScreenProps } from '../../../types/navigation.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const OTP_LENGTH = 6;
const RESEND_DELAY = 60; // seconds

type Props = AuthStackScreenProps<typeof AuthRoutes.OTP>;

// ─── Screen ───────────────────────────────────────────────────────────────────

const OtpScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const toast = useToast();

  const { email, flow } = route.params;

  // ── State ──────────────────────────────────────────────────────────────────
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_DELAY);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRefs = useRef<Array<TextInput | null>>(
    Array(OTP_LENGTH).fill(null),
  );

  // Per-cell scale animations for fill feedback
  const scaleAnims = useRef(
    Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1)),
  ).current;

  const { mutate: verifyOtp, isPending: verifying } = useVerifyOtp();
  const { mutate: resendOtp, isPending: resending } = useResendOtp();

  // ── Resend countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Auto-submit when all 6 digits filled ──────────────────────────────────
  useEffect(() => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH && !digits.includes('')) {
      handleVerify(otp);
    }
  }, [digits]);

  // ── Cell bounce animation ──────────────────────────────────────────────────
  const bounceCell = (index: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 1.12,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ── Digit change handler ───────────────────────────────────────────────────
  const handleDigitChange = useCallback(
    (text: string, index: number) => {
      // Allow paste: handle multiple chars at once
      const cleaned = text.replace(/\D/g, '');

      if (cleaned.length > 1) {
        // Paste scenario — distribute across cells
        const next = [...digits];
        let focusIdx = index;
        for (let i = 0; i < cleaned.length && index + i < OTP_LENGTH; i++) {
          next[index + i] = cleaned[i];
          focusIdx = index + i;
          bounceCell(index + i);
        }
        setDigits(next);
        const nextFocus = Math.min(focusIdx + 1, OTP_LENGTH - 1);
        inputRefs.current[nextFocus]?.focus();
        return;
      }

      const char = cleaned.slice(-1);
      const next = [...digits];
      next[index] = char;
      setDigits(next);

      if (char) {
        bounceCell(index);
        if (index < OTP_LENGTH - 1) {
          inputRefs.current[index + 1]?.focus();
        }
      }
    },
    [digits],
  );

  // ── Backspace handler ──────────────────────────────────────────────────────
  const handleKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace') {
        if (digits[index]) {
          // Clear current cell
          const next = [...digits];
          next[index] = '';
          setDigits(next);
        } else if (index > 0) {
          // Move back and clear previous
          const next = [...digits];
          next[index - 1] = '';
          setDigits(next);
          inputRefs.current[index - 1]?.focus();
        }
      }
    },
    [digits],
  );

  // ── Verify ─────────────────────────────────────────────────────────────────
  const handleVerify = (otp: string) => {
    verifyOtp(
      { email, otp, flow },
      {
        onSuccess: ({ data, message, success }) => {
          if (flow === 'forgot_password') {
            navigation.navigate(AuthRoutes.RESET_PASSWORD, { email, otp });
          }
          // signup flow → RootNavigator auth gate transitions automatically
        },
        onError: (err: any) => {
          toast.error(err?.message ?? 'Invalid code. Please try again.');
          // Shake and clear
          const next = Array(OTP_LENGTH).fill('');
          setDigits(next);
          inputRefs.current[0]?.focus();
        },
      },
    );
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = () => {
    resendOtp(
      { email, flow },
      {
        onSuccess: () => {
          setCountdown(RESEND_DELAY);
          setDigits(Array(OTP_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
          toast.success('New code sent to your email!');
        },
        onError: (err: any) =>
          toast.error(err?.message ?? 'Failed to resend. Please try again.'),
      },
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const maskedEmail = email.replace(
    /^(.{2})(.*)(@.+)$/,
    (_, a, b, c) => a + '*'.repeat(Math.max(0, b.length)) + c,
  );

  const filledCount = digits.filter(Boolean).length;
  const isComplete = filledCount === OTP_LENGTH;

  const formatCountdown = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(
      2,
      '0',
    )}`;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
  <Screen safeArea={false} scroll header={<Header backLabel="Back" showBack />}>
      <AppView style={[s.content, { paddingBottom: insets.bottom + 24 }]}>
        {/* ── Hero ── */}
        <AppView style={s.hero}>
          <AppView
            style={[s.iconWrap, { backgroundColor: colors.primary + '15' }]}
          >
            <AppText style={s.iconEmoji}>✉️</AppText>
          </AppView>

          <AppText style={[s.title, { color: colors.foreground }]}>
            Check your email
          </AppText>
          <AppText style={[s.subtitle, { color: colors.mutedForeground }]}>
            We sent a 6-digit code to
          </AppText>
          <AppText style={[s.emailText, { color: colors.foreground }]}>
            {maskedEmail}
          </AppText>
        </AppView>

        {/* ── OTP Boxes ── */}
        <AppView style={s.otpRow}>
          {digits.map((digit, i) => {
            const isActive = activeIdx === i;
            const isFilled = !!digit;

            const cellBorderColor = isFilled
              ? colors.primary
              : isActive
              ? colors.primary
              : colors.border;

            const cellBorderWidth = isFilled || isActive ? 1.5 : 1;
            const cellBg = isFilled
              ? colors.primary + '10'
              : colors.inputBackground;

            return (
              <Animated.View
                key={i}
                style={[s.cellWrap, { transform: [{ scale: scaleAnims[i] }] }]}
              >
                <TextInput
                  ref={el => {
                    inputRefs.current[i] = el;
                  }}
                  style={[
                    s.cell,
                    {
                      backgroundColor: cellBg,
                      borderColor: cellBorderColor,
                      borderWidth: cellBorderWidth,
                      color: colors.foreground,
                    },
                  ]}
                  value={digit}
                  onChangeText={text => handleDigitChange(text, i)}
                  onKeyPress={({ nativeEvent }) =>
                    handleKeyPress(nativeEvent.key, i)
                  }
                  onFocus={() => setActiveIdx(i)}
                  onBlur={() => setActiveIdx(-1)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH} // allows paste of full OTP
                  selectTextOnFocus
                  caretHidden
                  textAlign="center"
                  selectionColor={colors.primary}
                  autoFocus={i === 0}
                />
              </Animated.View>
            );
          })}
        </AppView>

        {/* ── Progress dots ── */}
        <AppView style={s.progressRow}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <AppView
              key={i}
              style={[
                s.progressDot,
                {
                  backgroundColor:
                    i < filledCount ? colors.primary : colors.border,
                  width: i < filledCount ? 16 : 6,
                },
              ]}
            />
          ))}
        </AppView>

        {/* ── Verify button ── */}
        <Button
          label="Verify Code"
          onPress={() => handleVerify(digits.join(''))}
          disabled={!isComplete || verifying}
          loading={verifying}
          fullWidth
          size="lg"
          style={{ marginBottom: 28 }}
        />

        {/* ── Resend section ── */}
        <AppView style={s.resendRow}>
          <AppText style={[s.resendPrompt, { color: colors.mutedForeground }]}>
            Didn't receive the code?
          </AppText>

          {countdown > 0 ? (
            <AppView style={s.countdownWrap}>
              <AppText
                style={[s.countdownText, { color: colors.mutedForeground }]}
              >
                {' '}
                Resend in{' '}
              </AppText>
              <AppView
                style={[
                  s.countdownBadge,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <AppText style={[s.countdownTimer, { color: colors.foreground }]}>
                  {formatCountdown(countdown)}
                </AppText>
              </AppView>
            </AppView>
          ) : (
            <Button
              label={resending ? 'Sending...' : ' Resend code'}
              onPress={handleResend}
              disabled={resending}
              variant="ghost"
              size="sm"
              loading={resending}
              labelStyle={{ color: colors.primary, fontSize: 15, fontWeight: '600' }}
            />
          )}
        </AppView>

        {/* ── Wrong email hint ── */}
        <Button
          label="Wrong email address? Change it"
          onPress={() => navigation.goBack()}
          variant="ghost"
          size="sm"
          style={s.wrongEmailBtn}
          labelStyle={{ color: colors.mutedForeground, fontSize: 14 }}
        />
      </AppView>
    </Screen>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CELL_SIZE = 52;

const s = StyleSheet.create({
  flex: { flex: 1 },

  // Nav
  navbar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  // Layout
  content: { flex: 1, paddingHorizontal: 24 },

  // Hero
  hero: { paddingTop: 36, paddingBottom: 0 },
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
    marginBottom: 8,
  },
  subtitle: { fontSize: 16, color: '#888', lineHeight: 22 },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 36,
  },

  // OTP grid
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cellWrap: {},
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE + 8,
    borderRadius: 12,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Progress
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 32,
  },
  progressDot: {
    height: 6,
    borderRadius: 3,
  },

  // Resend
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  resendPrompt: { fontSize: 15 },
  countdownWrap: { flexDirection: 'row', alignItems: 'center' },
  countdownText: { fontSize: 15 },
  countdownBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 4,
  },
  countdownTimer: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Wrong email
  wrongEmailBtn: { alignItems: 'center', marginTop: 8 },
});

export default OtpScreen;
