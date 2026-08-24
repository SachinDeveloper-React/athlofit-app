// src/features/health/components/tracker/StepTrackingDisabledBanner.tsx
//
// Shown whenever an admin has paused step tracking for this account.
//
// Deliberately NOT dismissible, unlike the permission banner next to it. While
// this is up the step count is frozen and no step coins are being earned, so a
// user who dismissed it would be left staring at a number that never moves with
// no explanation — which reads as the app being broken. The banner IS the
// explanation, and it stays until the server says tracking is back on.

import React, { memo, useCallback } from 'react';
import { Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import AppText from '../../../../components/AppText';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { isVersionBlocked, useStepTrackingStore } from '../../../../store/stepTrackingStore';
import { useAppConfigStore } from '../../../../store/appConfigStore';
import { APP_CONFIG_DEFAULTS } from '../../../../config/appConfig';

const StepTrackingDisabledBanner = memo(() => {
  const { colors, spacing, radius } = useTheme();
  const enabled = useStepTrackingStore(s => s.enabled);
  const reason = useStepTrackingStore(s => s.reason);
  // Subscribed so the banner re-renders when a build block lands mid-session,
  // then resolved through isVersionBlocked(), which also drops a stale block
  // left over from a previous build.
  const blockedVersion = useStepTrackingStore(s => s.blockedVersion);
  const blockedVersionReason = useStepTrackingStore(s => s.blockedVersionReason);
  const config = useAppConfigStore(s => s.config);

  const versionBlocked = blockedVersion !== null && isVersionBlocked();

  const handleUpdate = useCallback(() => {
    const url =
      config?.appLinks?.[Platform.OS === 'ios' ? 'appStore' : 'playStore'] || '';
    if (url) {
      Linking.openURL(url).catch(() => {});
      return;
    }
    // No store link configured — fall back to the store listing by package id
    // rather than leaving the only actionable button dead.
    Linking.openURL(
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/athlofit'
        : 'market://details?id=com.athlofit.athlofit',
    ).catch(() => {});
  }, [config]);

  const handleContactSupport = useCallback(() => {
    const number = config?.support?.whatsapp || APP_CONFIG_DEFAULTS.support.whatsapp;
    const text = encodeURIComponent(
      'Hello, my step tracking has been paused on Athlofit. Could you help?',
    );
    // Fall back to the wa.me web link — the whatsapp:// scheme fails on devices
    // without the app installed, and this banner is the user's only route to
    // getting the pause lifted.
    Linking.openURL(`whatsapp://send?phone=${number}&text=${text}`).catch(() => {
      Linking.openURL(`https://wa.me/${number}?text=${text}`).catch(() => {});
    });
  }, [config]);

  // Two different pauses reach this banner. An ACCOUNT pause is lifted by
  // support; a BUILD pause is lifted only by updating the app. Showing the
  // wrong call to action sends the user down a road that cannot help them, so
  // the copy and the button both switch.
  if (enabled && !versionBlocked) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: withOpacity(colors.destructive, 0.08),
          borderColor: withOpacity(colors.destructive, 0.22),
          marginBottom: spacing[3],
          borderRadius: radius.lg,
        },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: withOpacity(colors.destructive, 0.12) }]}>
          <Icon name="Footprints" size={16} color={colors.destructive} />
        </View>
        <View style={styles.textWrap}>
          <AppText variant="subhead" weight="semiBold" style={{ color: colors.destructive }}>
            {versionBlocked ? 'Update Required' : 'Step Tracking Paused'}
          </AppText>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }}>
            {versionBlocked ? blockedVersionReason : reason}
          </AppText>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 4 }}>
            Your steps are not being counted and no step coins are being earned.
            Everything else in the app works normally.
          </AppText>
          <TouchableOpacity
            onPress={versionBlocked ? handleUpdate : handleContactSupport}
            activeOpacity={0.7}
            style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
            accessibilityRole="button"
            accessibilityLabel={
              versionBlocked
                ? 'Update the app to resume step tracking'
                : 'Contact support about paused step tracking'
            }
          >
            <AppText variant="caption1" weight="semiBold" style={{ color: '#FFFFFF' }}>
              {versionBlocked ? 'Update Now' : 'Contact Support'}
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

StepTrackingDisabledBanner.displayName = 'StepTrackingDisabledBanner';
export default StepTrackingDisabledBanner;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  actionBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
});
