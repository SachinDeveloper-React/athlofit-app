// src/components/PhoneVerifyModal.tsx
// Modal for verifying phone number with OTP

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import BottomSheet from './BottomSheet';
import AppText from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { phoneService } from '../features/auth/service/phoneService';
import { useAuthStore } from '../features/auth/store/authStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = 'phone' | 'otp' | 'success';

const PhoneVerifyModal = memo(({ visible, onClose }: Props) => {
  const { colors, spacing, radius } = useTheme();
  const [step, setStep] = useState<Step>('phone');
  const userPhone = useAuthStore(s => s.user?.phone);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dismiss keyboard before closing to prevent residual space from KeyboardAvoidingView
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    // Small delay to let keyboard fully dismiss before closing modal
    setTimeout(onClose, 100);
  }, [onClose]);

  // Reset state when modal opens, pre-fill phone from user profile
  useEffect(() => {
    if (visible) {
      setStep('phone');
      // Pre-fill with user's phone (strip +91 prefix if present)
      const existingPhone = userPhone ? userPhone.replace(/^\+?91/, '').replace(/\D/g, '') : '';
      setPhone(existingPhone);
      setOtp(['', '', '', '', '', '']);
      setError(null);
      setIsLoading(false);
    }
  }, [visible, userPhone]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown]);

  const handleSendOtp = useCallback(async () => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await phoneService.sendOtp(cleanPhone);
      if (res.success) {
        setMaskedPhone(res.data?.phone || `******${cleanPhone.slice(-4)}`);
        setStep('otp');
        setCooldown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 300);
      } else {
        setError(res.message || 'Failed to send OTP');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    const otpStr = otp.join('');
    if (otpStr.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await phoneService.verifyOtp(otpStr);
      if (res.success) {
        // Update user in auth store
        useAuthStore.getState().updateUser({ phoneVerified: true, phone: res.data?.phone });
        setStep('success');
        setTimeout(() => handleClose(), 1500);
      } else {
        setError(res.message || 'Invalid OTP');
      }
    } catch (e: any) {
      setError(e?.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  }, [otp, onClose]);

  const handleOtpChange = useCallback((value: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      Keyboard.dismiss();
      const otpStr = newOtp.join('');
      if (otpStr.length === 6) {
        // Small delay for UX
        setTimeout(() => {
          setOtp(newOtp);
          handleVerifyOtp();
        }, 200);
      }
    }
  }, [otp, handleVerifyOtp]);

  const handleOtpKeyPress = useCallback((key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  }, [otp]);

  const handleResend = useCallback(async () => {
    if (cooldown > 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const cleanPhone = phone.replace(/\D/g, '');
      const res = await phoneService.sendOtp(cleanPhone);
      if (res.success) {
        setCooldown(60);
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      } else {
        setError(res.message || 'Failed to resend OTP');
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, [phone, cooldown]);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={step === 'success' ? '' : 'Verify Phone Number'}
      snapHeight="55%"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
      >
        <ScrollView
          bounces={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
      <View style={[styles.content, { paddingHorizontal: spacing[4] }]}>
        {/* ── Phone Input Step ── */}
        {step === 'phone' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
              <Icon name="Smartphone" size={28} color={colors.primary} />
            </View>
            <AppText variant="body" secondary style={styles.description}>
              Enter your phone number to receive a verification code via SMS.
            </AppText>

            <View style={[styles.phoneRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <AppText variant="body" weight="semiBold" style={{ color: colors.foreground }}>
                +91
              </AppText>
              <TextInput
                style={[styles.phoneInput, { color: colors.foreground }]}
                placeholder="Enter 10-digit number"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
                maxLength={10}
                value={phone}
                onChangeText={(t) => { setPhone(t); setError(null); }}
                autoFocus
              />
            </View>

            {error && (
              <AppText variant="caption1" style={{ color: colors.destructive, marginTop: spacing[2] }}>
                {error}
              </AppText>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, marginTop: spacing[4] }]}
              onPress={handleSendOtp}
              disabled={isLoading || phone.replace(/\D/g, '').length !== 10}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AppText variant="headline" weight="semiBold" style={{ color: '#fff' }}>
                  Send OTP
                </AppText>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ── OTP Input Step ── */}
        {step === 'otp' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
              <Icon name="ShieldCheck" size={28} color={colors.primary} />
            </View>
            <AppText variant="body" secondary style={styles.description}>
              Enter the 6-digit code sent to {maskedPhone}
            </AppText>

            <View style={styles.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={(ref) => { otpRefs.current[i] = ref; }}
                  style={[
                    styles.otpBox,
                    {
                      borderColor: digit ? colors.primary : colors.border,
                      backgroundColor: colors.card,
                      color: colors.foreground,
                    },
                  ]}
                  keyboardType="number-pad"
                  maxLength={1}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(v, i)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                  selectTextOnFocus
                />
              ))}
            </View>

            {error && (
              <AppText variant="caption1" style={{ color: colors.destructive, marginTop: spacing[2] }}>
                {error}
              </AppText>
            )}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, marginTop: spacing[4] }]}
              onPress={handleVerifyOtp}
              disabled={isLoading || otp.join('').length !== 6}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AppText variant="headline" weight="semiBold" style={{ color: '#fff' }}>
                  Verify
                </AppText>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleResend}
              disabled={cooldown > 0}
              style={{ marginTop: spacing[3], alignSelf: 'center' }}
            >
              <AppText
                variant="subhead"
                style={{ color: cooldown > 0 ? colors.mutedForeground : colors.primary }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </AppText>
            </TouchableOpacity>
          </>
        )}

        {/* ── Success Step ── */}
        {step === 'success' && (
          <View style={styles.successWrap}>
            <View style={[styles.iconWrap, { backgroundColor: withOpacity('#10B981', 0.1) }]}>
              <Icon name="CheckCircle" size={36} color="#10B981" />
            </View>
            <AppText variant="title3" weight="bold" style={{ marginTop: spacing[3], color: colors.foreground }}>
              Phone Verified!
            </AppText>
            <AppText variant="body" secondary style={{ marginTop: spacing[1], textAlign: 'center' }}>
              Your phone number has been verified successfully.
            </AppText>
          </View>
        )}
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
});

PhoneVerifyModal.displayName = 'PhoneVerifyModal';
export default PhoneVerifyModal;

const styles = StyleSheet.create({
  content: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 21,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    gap: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    letterSpacing: 1,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  button: {
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
});
