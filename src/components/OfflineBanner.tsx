import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useNetworkStore } from '../store/networkStore';
import { Icon } from './Icon';
import AppText from './AppText';

const BANNER_HEIGHT = 44;
const ANIMATION_DURATION = 300;

/**
 * OfflineBanner — displays a connectivity warning when the device is offline.
 *
 * Reads `isOnline` from `useNetworkStore` and animates in/out with height + opacity.
 * Positioned at the top of the content area (below navigation header).
 * Self-contained: just drop `<OfflineBanner />` into any screen.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const OfflineBanner: React.FC = () => {
  const { colors, isDark } = useTheme();
  const isOnline = useNetworkStore(state => state.isOnline);

  const animatedHeight = useRef(new Animated.Value(isOnline ? 0 : BANNER_HEIGHT)).current;
  const animatedOpacity = useRef(new Animated.Value(isOnline ? 0 : 1)).current;

  // Track whether we've been offline so we can delay dismiss on reconnection
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (!isOnline) {
      // Animate in immediately when going offline
      Animated.parallel([
        Animated.timing(animatedHeight, {
          toValue: BANNER_HEIGHT,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(animatedOpacity, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      // Dismiss within 3 seconds of connectivity restoration
      dismissTimerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(animatedHeight, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            useNativeDriver: false,
          }),
          Animated.timing(animatedOpacity, {
            toValue: 0,
            duration: ANIMATION_DURATION,
            useNativeDriver: false,
          }),
        ]).start();
      }, 2700); // 2700ms delay + 300ms animation ≈ 3s total dismiss time
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, [isOnline, animatedHeight, animatedOpacity]);

  const backgroundColor = isDark
    ? 'rgba(255, 165, 0, 0.15)' // warning color with low opacity for dark mode
    : 'rgba(255, 165, 0, 0.12)'; // warning color with low opacity for light mode

  const borderColor = isDark
    ? 'rgba(255, 165, 0, 0.3)'
    : 'rgba(255, 165, 0, 0.25)';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: animatedHeight,
          opacity: animatedOpacity,
          backgroundColor,
          borderBottomColor: borderColor,
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel="No internet connection"
    >
      <View style={styles.content}>
        <Icon
          name="WifiOff"
          size={24}
          color={colors.warning}
          accessibilityLabel="Wi-Fi off"
        />
        <AppText
          variant="subhead"
          weight="medium"
          color={colors.foreground}
          style={styles.text}
        >
          No internet connection
        </AppText>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    marginLeft: 4,
  },
});

export default OfflineBanner;
