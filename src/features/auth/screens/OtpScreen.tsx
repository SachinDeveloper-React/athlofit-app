import React, { useRef, useState, useEffect, useCallback } from 'react';
import { TextInput, Animated } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../hooks/useTheme';
import { makeStyles } from '../../../hooks/makeStyles';
import { useToast } from '../../../components/Toast';
import { AppView, AppText, Button, Screen, Header } from '../../../components';
import { useVerifyOtp, useResendOtp } from '../hooks/useOtp';
import { AuthRoutes } from '../../../navigation/routes';
import type { AuthStackScreenProps } from '../../../types/navigation.types';

const OTP_LENGTH  = 6;
const RESEND_DELAY = 60;

type Props = AuthStackScreenProps<typeof AuthRoutes.OTP>;

const useStyles = makeStyles(({ spacing, radius, fontSize, fontWeight }) => ({
  content:      { flex: 1 },
  hero:         { paddingTop: spacing[8], paddingBottom: 0 },
  iconWrap:     {
    width: 64, height: 64,
    borderRadius: radius.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing[5],
  },
  iconEmoji:    { fontSize: fontSize['3xl'] },
  title: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    letterSpacing: -0.4,
    marginBottom: spacing[2],
  },
  subtitle:     { fontSize: fontSize.base, lineHeight: 22 },
  emailText:    { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, marginTop: spacing[0.5], marginBottom: spacing[8] },
  otpRow:       { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: spacing[4] },
  cellWrap:     {},
  cell: {
    width: 52, height: 60,
    borderRadius: radius.lg,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.bold,
    textAlign: 'center' as const,
  },
  progressRow:  { flexDirection: 'row' as const, justifyContent: 'center' as const, alignItems: 'center' as const, gap: spacing[1], marginBottom: spacing[8] },
  progressDot:  { height: 6, borderRadius: radius.full },
  resendRow:    { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, flexWrap: 'wrap' as const, marginBottom: spacing[4] },
  resendPrompt: { fontSize: fontSize.md },
  countdownWrap:{ flexDirection: 'row' as const, alignItems: 'center' as const },
  countdownText:{ fontSize: fontSize.md },
  countdownBadge: { paddingHorizontal: spacing[2], paddingVertical: spacing[0.5], borderRadius: radius.md, marginLeft: spacing[1] },
  countdownTimer: { fontSize: fontSize.sm, fontWeight: fontWeight.semiBold },
  wrongEmailBtn:{ alignItems: 'center' as const, marginTop: spacing[2] },
}));

const OtpScreen: React.FC<Props> = () => {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Props['navigation']>();
  const route = useRoute<Props['route']>();
  const toast = useToast();

  const { email, flow } = route.params;

  const [digits, setDigits]     = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [countdown, setCountdown] = useState(RESEND_DELAY);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRefs  = useRef<Array<TextInput | null>>(Array(OTP_LENGTH).fill(null));
  const scaleAnims = useRef(Array.from({ length: OTP_LENGTH }, () => new Animated.Value(1))).current;

  const { mutate: verifyOtp, isPending: verifying } = useVerifyOtp();
  const { mutate: resendOtp, isPending: resending }  = useResendOtp();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH && !digits.includes('')) handleVerify(otp);
  }, [digits]);

  const bounceCell = (index: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 1.12, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnims[index], { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const handleDigitChange = useCallback((text: string, index: number) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const next = [...digits];
      let focusIdx = index;
      for (let i = 0; i < cleaned.length && index + i < OTP_LENGTH; i++) {
        next[index + i] = cleaned[i];
        focusIdx = index + i;
        bounceCell(index + i);
      }
      setDigits(next);
      inputRefs.current[Math.min(focusIdx + 1, OTP_LENGTH - 1)]?.focus();
      return;
    }
    const char = cleaned.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char) {
      bounceCell(index);
      if (index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus();
    }
  }, [digits]);

  const handleKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits]; next[index] = ''; setDigits(next);
      } else if (index > 0) {
        const next = [...digits]; next[index - 1] = ''; setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    }
  }, [digits]);

  const handleVerify = (otp: string) => {
    verifyOtp({ email, otp, flow }, {
      onSuccess: () => {
        if (flow === 'forgot_password') navigation.navigate(AuthRoutes.RESET_PASSWORD, { email, otp });
      },
      onError: (err: any) => {
        toast.error(err?.message ?? 'Invalid code. Please try again.');
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      },
    });
  };

  const handleResend = () => {
    resendOtp({ email, flow }, {
      onSuccess: () => {
        setCountdown(RESEND_DELAY);
        setDigits(Array(OTP_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
        toast.success('New code sent to your email!');
      },
      onError: (err: any) => toast.error(err?.message ?? 'Failed to resend.'),
    });
  };

  const maskedEmail  = email.replace(/^(.{2})(.*)(@.+)$/, (_, a, b, c) => a + '*'.repeat(Math.max(0, b.length)) + c);
  const filledCount  = digits.filter(Boolean).length;
  const isComplete   = filledCount === OTP_LENGTH;
  const formatCountdown = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Screen safeArea={false} scroll header={<Header backLabel="Back" showBack />}>
      <AppView style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <AppView style={styles.hero}>
          <AppView style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
            <AppText style={styles.iconEmoji}>✉️</AppText>
          </AppView>
          <AppText style={[styles.title, { color: colors.foreground }]}>Check your email</AppText>
          <AppText style={[styles.subtitle, { color: colors.mutedForeground }]}>We sent a 6-digit code to</AppText>
          <AppText style={[styles.emailText, { color: colors.foreground }]}>{maskedEmail}</AppText>
        </AppView>

        <AppView style={styles.otpRow}>
          {digits.map((digit, i) => {
            const isFilled = !!digit;
            const isActive = activeIdx === i;
            return (
              <Animated.View key={i} style={[styles.cellWrap, { transform: [{ scale: scaleAnims[i] }] }]}>
                <TextInput
                  ref={el => { inputRefs.current[i] = el; }}
                  style={[styles.cell, {
                    backgroundColor: isFilled ? colors.primary + '10' : colors.inputBackground,
                    borderColor: isFilled || isActive ? colors.primary : colors.border,
                    borderWidth: isFilled || isActive ? 1.5 : 1,
                    color: colors.foreground,
                  }]}
                  value={digit}
                  onChangeText={text => handleDigitChange(text, i)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                  onFocus={() => setActiveIdx(i)}
                  onBlur={() => setActiveIdx(-1)}
                  keyboardType="number-pad"
                  maxLength={OTP_LENGTH}
                  selectTextOnFocus caretHidden textAlign="center"
                  selectionColor={colors.primary}
                  autoFocus={i === 0}
                />
              </Animated.View>
            );
          })}
        </AppView>

        <AppView style={styles.progressRow}>
          {Array.from({ length: OTP_LENGTH }).map((_, i) => (
            <AppView key={i} style={[styles.progressDot, {
              backgroundColor: i < filledCount ? colors.primary : colors.border,
              width: i < filledCount ? 16 : 6,
            }]} />
          ))}
        </AppView>

        <Button label="Verify Code" onPress={() => handleVerify(digits.join(''))}
          disabled={!isComplete || verifying} loading={verifying}
          fullWidth size="lg" style={{ marginBottom: 28 }} />

        <AppView style={styles.resendRow}>
          <AppText style={[styles.resendPrompt, { color: colors.mutedForeground }]}>
            Didn't receive the code?
          </AppText>
          {countdown > 0 ? (
            <AppView style={styles.countdownWrap}>
              <AppText style={[styles.countdownText, { color: colors.mutedForeground }]}> Resend in </AppText>
              <AppView style={[styles.countdownBadge, { backgroundColor: colors.secondary }]}>
                <AppText style={[styles.countdownTimer, { color: colors.foreground }]}>
                  {formatCountdown(countdown)}
                </AppText>
              </AppView>
            </AppView>
          ) : (
            <Button label={resending ? 'Sending...' : ' Resend code'} onPress={handleResend}
              disabled={resending} variant="ghost" size="sm" loading={resending}
              labelStyle={{ color: colors.primary, fontWeight: '600' }} />
          )}
        </AppView>

        <Button fullWidth label="Wrong email address? Change it" onPress={() => navigation.goBack()}
          variant="ghost" size="sm" style={styles.wrongEmailBtn}
          labelStyle={{ color: colors.mutedForeground }} />
      </AppView>
    </Screen>
  );
};

export default OtpScreen;
