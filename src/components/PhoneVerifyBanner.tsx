// src/components/PhoneVerifyBanner.tsx
// Small dismissible banner shown on home screen when phone is not verified.

import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import AppText from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { useAuthStore } from '../features/auth/store/authStore';
import PhoneVerifyModal from './PhoneVerifyModal';

const PhoneVerifyBanner = memo(() => {
  const { colors, spacing, radius } = useTheme();
  const phoneVerified = useAuthStore(s => s.user?.phoneVerified);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already verified or dismissed
  if (phoneVerified || dismissed) return null;

  return (
    <>
      <Animated.View
        entering={FadeInDown.duration(300)}
        exiting={FadeOutUp.duration(200)}
        style={[
          styles.container,
          {
            backgroundColor: withOpacity(colors.warning, 0.1),
            borderColor: withOpacity(colors.warning, 0.25),
            marginHorizontal: spacing[4],
            marginBottom: spacing[3],
            borderRadius: radius.lg,
          },
        ]}
      >
        <Pressable
          style={styles.content}
          onPress={() => setShowModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Verify your phone number"
        >
          <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.warning, 0.15) }]}>
            <Icon name="Smartphone" size={16} color={colors.warning} />
          </View>
          <View style={styles.textWrap}>
            <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
              Verify your phone number
            </AppText>
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 1 }}>
              Tap to verify and secure your account
            </AppText>
          </View>
          <Icon name="ChevronRight" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* Dismiss button */}
        <Pressable
          style={styles.dismiss}
          onPress={() => setDismissed(true)}
          hitSlop={8}
          accessibilityLabel="Dismiss"
        >
          <Icon name="X" size={14} color={colors.mutedForeground} />
        </Pressable>
      </Animated.View>

      <PhoneVerifyModal visible={showModal} onClose={() => setShowModal(false)} />
    </>
  );
});

PhoneVerifyBanner.displayName = 'PhoneVerifyBanner';
export default PhoneVerifyBanner;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingRight: 32,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
  },
  dismiss: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
