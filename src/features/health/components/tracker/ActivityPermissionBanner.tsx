// src/features/health/components/tracker/ActivityPermissionBanner.tsx
//
// Professional banner shown on the Tracker screen when Health Connect is granted
// but ACTIVITY_RECOGNITION permission is denied. Prompts the user to enable it
// for real-time step updates (live notification, widget, instant UI updates).

import React, { memo, useCallback, useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import AppText from '../../../../components/AppText';
import { Icon } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { mmkv } from '../../../../store';

const DISMISSED_KEY = 'activity_permission_banner_dismissed';
const DENY_COUNT_KEY = 'activity_permission_deny_count';

interface Props {
  /** Current health platform — banner only shows when 'healthconnect' (HC granted). */
  platform: string;
  /** Whether health setup is complete and ready. */
  isReady: boolean;
}

const ActivityPermissionBanner = memo(({ platform, isReady }: Props) => {
  const { colors, spacing, radius } = useTheme();
  const [visible, setVisible] = useState(false);
  const [shouldOpenSettings, setShouldOpenSettings] = useState(false);

  useEffect(() => {
    // Only relevant on Android when Health Connect is the active platform
    if (Platform.OS !== 'android' || platform !== 'healthconnect' || !isReady) {
      setVisible(false);
      return;
    }

    // Don't show if user previously dismissed
    const dismissed = mmkv.getBoolean(DISMISSED_KEY);
    if (dismissed) {
      setVisible(false);
      return;
    }

    // Check ACTIVITY_RECOGNITION permission status
    const checkPermission = async () => {
      try {
        const { stepService } = await import('../../../../services/stepService');
        const status = await stepService.getActivityPermissionStatus();
        if (status === 'denied') {
          setVisible(true);
          // If denied multiple times, next tap should open settings
          const denyCount = mmkv.getNumber(DENY_COUNT_KEY) ?? 0;
          setShouldOpenSettings(denyCount >= 2);
        } else {
          setVisible(false);
        }
      } catch {
        setVisible(false);
      }
    };

    checkPermission();
  }, [platform, isReady]);

  const handleAllow = useCallback(async () => {
    try {
      if (shouldOpenSettings) {
        // User denied multiple times — Android won't show the dialog again,
        // open app settings so they can enable it manually.
        Linking.openSettings();
        return;
      }

      const { stepService } = await import('../../../../services/stepService');
      const started = await stepService.requestPermissionAndStart();
      if (started) {
        // Permission granted — reset deny count and hide banner
        mmkv.set(DENY_COUNT_KEY, 0);
        setVisible(false);
      } else {
        // Denied again — increment count
        const currentCount = mmkv.getNumber(DENY_COUNT_KEY) ?? 0;
        const newCount = currentCount + 1;
        mmkv.set(DENY_COUNT_KEY, newCount);
        if (newCount >= 2) {
          setShouldOpenSettings(true);
        }
      }
    } catch {
      // Permission dialog dismissed or denied again — keep banner visible
    }
  }, [shouldOpenSettings]);

  const handleDismiss = useCallback(() => {
    mmkv.set(DISMISSED_KEY, true);
    setVisible(false);
  }, []);

  if (!visible) return null;

  const accentColor = '#0099FF';

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.container,
        {
          backgroundColor: withOpacity(accentColor, 0.06),
          borderColor: withOpacity(accentColor, 0.18),
          marginTop: spacing[3],
          marginBottom: spacing[3],
          borderRadius: radius.lg,
        },
      ]}
    >
      {/* Dismiss button */}
      <TouchableOpacity
        onPress={handleDismiss}
        hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        style={styles.dismissBtn}
        accessibilityLabel="Dismiss banner"
        accessibilityRole="button"
      >
        <Icon name="X" size={14} color={colors.mutedForeground} />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: withOpacity(accentColor, 0.12) }]}>
          <Icon name="Footprints" size={16} color={accentColor} />
        </View>
        <View style={styles.textWrap}>
          <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
            Enable Real-Time Steps
          </AppText>
          <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 2 }}>
            {shouldOpenSettings
              ? 'Permission was denied. Tap below to open Settings and enable activity access manually.'
              : 'Allow activity access for live step count in notifications and faster updates.'}
          </AppText>
          <TouchableOpacity
            onPress={handleAllow}
            activeOpacity={0.7}
            style={[styles.allowBtn, { backgroundColor: accentColor }]}
            accessibilityLabel={shouldOpenSettings ? 'Open app settings' : 'Allow activity permission'}
            accessibilityRole="button"
          >
            <AppText variant="caption1" weight="semiBold" style={{ color: '#FFFFFF' }}>
              {shouldOpenSettings ? 'Open Settings' : 'Allow Access'}
            </AppText>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
});

ActivityPermissionBanner.displayName = 'ActivityPermissionBanner';
export default ActivityPermissionBanner;

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    paddingRight: 28,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  textWrap: {
    flex: 1,
  },
  allowBtn: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    padding: 4,
  },
});
