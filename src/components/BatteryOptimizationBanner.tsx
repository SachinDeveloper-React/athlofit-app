// src/components/BatteryOptimizationBanner.tsx
// Subtle, dismissible banner shown on the Tracker screen when the device
// is NOT exempt from battery optimization. Checks once per mount, shows
// max 1x per day.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, StyleSheet, View, TouchableOpacity, Platform } from 'react-native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius } from '../constants/spacing';
import { mmkv } from '../store';
import { stepService } from '../services/stepService';
import { BatteryWarning, X } from 'lucide-react-native';

const BANNER_KEY = 'battery_banner_last_shown';
const BANNER_HEIGHT = 56;
const ANIM_DURATION = 280;

const BatteryOptimizationBanner: React.FC = () => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Check if already exempt — no need to show banner
    stepService.isIgnoringBatteryOptimizations().then((exempt) => {
      if (exempt) return;

      // Check if already shown today
      const lastShown = mmkv.getNumber(BANNER_KEY);
      if (lastShown) {
        const elapsed = Date.now() - lastShown;
        if (elapsed < 24 * 60 * 60 * 1000) return; // < 24h ago
      }

      // Show the banner
      setVisible(true);
      mmkv.set(BANNER_KEY, Date.now());

      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: BANNER_HEIGHT,
          duration: ANIM_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: ANIM_DURATION,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, []);

  const handlePress = useCallback(async () => {
    await stepService.requestDisableBatteryOptimization();
  }, []);

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: ANIM_DURATION,
        useNativeDriver: false,
      }),
    ]).start(() => setVisible(false));
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: heightAnim,
          opacity: opacityAnim,
          backgroundColor: colors.primary + '12',
          borderColor: colors.primary + '30',
        },
      ]}
      accessibilityRole="alert"
      accessibilityLabel="Battery optimization is restricting step tracking"
    >
      <TouchableOpacity
        style={styles.content}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <BatteryWarning size={18} color={colors.primary} />
        <AppText
          variant="caption1"
          weight="medium"
          color={colors.foreground}
          style={styles.text}
          numberOfLines={1}
        >
          Steps may stop — tap to fix battery settings
        </AppText>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={handleDismiss}
        style={styles.closeBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing[4],
    marginTop: Spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
    gap: 8,
  },
  text: {
    flex: 1,
  },
  closeBtn: {
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
  },
});

export default BatteryOptimizationBanner;
