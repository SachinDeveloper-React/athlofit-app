// src/features/health/components/tracker/HealthGate.tsx
//
// Bottom-sheet warning shown when the health platform is unavailable.
//
//  Android — Health Connect not installed → prompt to download from Play Store
//  Android — No built-in pedometer sensor  → warn + offer to continue
//  iOS     — HealthKit permission denied    → deep-link to Settings
//  Both    — Generic error / not ready      → retry CTA
//
// Renders as a native-feeling bottom sheet:
//   • Animated slide-up on mount  (Reanimated spring)
//   • Scrim backdrop fades in
//   • Dismissible via backdrop tap or secondary button
//   • Non-dismissible for hard blockers (health-connect-missing, healthkit-denied)

import React, { memo, useCallback, useEffect } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  type PressableStateCallbackType,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AppText, AppView } from '../../../../components';

import { type HealthPlatform } from '../../hooks/useHealth';
import { Icon, LucideName } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealthGateReason =
  | 'health-connect-missing' // Android: Health Connect not installed
  | 'healthkit-denied' // iOS: HealthKit permission denied
  | 'error' // Generic API error
  | 'not-ready'; // Platform unavailable / first load failed

type Props = {
  /** Pass a reason to show the sheet; null/undefined hides it */
  reason: HealthGateReason | null;
  errorMessage?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
};

// ─── URLs ─────────────────────────────────────────────────────────────────────

const HEALTH_CONNECT_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const IOS_SETTINGS_URL = 'app-settings:';

// ─── Config map ───────────────────────────────────────────────────────────────

type GateConfig = {
  icon: LucideName;
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
  primaryLabel: string;
  primaryAction: 'url' | 'retry' | 'dismiss';
  primaryUrl?: string;
  secondaryLabel?: string;
  /** true = backdrop tap does NOT dismiss (hard blocker) */
  blocking?: boolean;
};

const GATE_CONFIG: Record<HealthGateReason, GateConfig> = {
  'health-connect-missing': {
    icon: 'HeartPulse',
    iconColor: '#D85A30',
    iconBg: '#FAECE7',
    title: 'Health Connect required',
    body:
      'This app uses Health Connect to read your activity data. ' +
      'Install it from the Play Store to continue.',
    primaryLabel: 'Download Health Connect',
    primaryAction: 'url',
    primaryUrl: HEALTH_CONNECT_URL,
    secondaryLabel: 'Skip for now',
    blocking: false,
  },

  'healthkit-denied': {
    icon: 'ShieldOff',
    iconColor: '#185FA5',
    iconBg: '#E6F1FB',
    title: 'Health access denied',
    body:
      'Allow access to Health in your iPhone Settings ' +
      'so we can read your activity and vitals.',
    primaryLabel: 'Open Settings',
    primaryAction: 'url',
    primaryUrl: IOS_SETTINGS_URL,
    secondaryLabel: 'Not now',
    blocking: false,
  },

  error: {
    icon: 'AlertCircle',
    iconColor: '#A32D2D',
    iconBg: '#FCEBEB',
    title: 'Something went wrong',
    body: 'We could not connect to your health data.',
    primaryLabel: 'Try again',
    primaryAction: 'retry',
    secondaryLabel: 'Dismiss',
    blocking: false,
  },

  'not-ready': {
    icon: 'RefreshCw',
    iconColor: '#5F5E5A',
    iconBg: '#F1EFE8',
    title: 'Health data unavailable',
    body: 'We were unable to load your health data.',
    primaryLabel: 'Retry',
    primaryAction: 'retry',
    secondaryLabel: 'Dismiss',
    blocking: false,
  },
};

// ─── Sheet height ─────────────────────────────────────────────────────────────

const SHEET_HEIGHT = 360;

// ─── HealthGate ───────────────────────────────────────────────────────────────

export const HealthGate = memo(
  ({ reason, errorMessage, onRetry, onDismiss }: Props) => {
    const { colors } = useTheme();

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const isVisible = !!reason;
    const cfg = reason ? GATE_CONFIG[reason] : null;

    // ── Animation ──────────────────────────────────────────────────────────────

    useEffect(() => {
      if (isVisible) {
        backdropOpacity.value = withTiming(1, {
          duration: 240,
          easing: Easing.out(Easing.ease),
        });
        translateY.value = withSpring(0, { damping: 22, stiffness: 200 });
      } else {
        backdropOpacity.value = withTiming(0, { duration: 180 });
        translateY.value = withSpring(SHEET_HEIGHT, {
          damping: 20,
          stiffness: 220,
        });
      }
    }, [isVisible, backdropOpacity, translateY]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleDismiss = useCallback(() => {
      if (cfg?.blocking) return;
      onDismiss?.();
    }, [cfg, onDismiss]);

    const handlePrimary = useCallback(async () => {
      if (!cfg) return;
      if (cfg.primaryAction === 'url' && cfg.primaryUrl) {
        await Linking.openURL(cfg.primaryUrl);
      } else if (cfg.primaryAction === 'retry') {
        onRetry?.();
      } else {
        handleDismiss();
      }
    }, [cfg, onRetry, handleDismiss]);

    const primaryPressStyle = useCallback(
      ({ pressed }: PressableStateCallbackType): ViewStyle => ({
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }),
      [],
    );

    const secondaryPressStyle = useCallback(
      ({ pressed }: PressableStateCallbackType): ViewStyle => ({
        opacity: pressed ? 0.55 : 1,
      }),
      [],
    );

    // ── Animated styles ───────────────────────────────────────────────────────

    const sheetAnimStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
    }));

    const backdropAnimStyle = useAnimatedStyle(() => ({
      opacity: backdropOpacity.value,
    }));

    if (!cfg) return null;

    return (
      <Modal
        transparent
        visible={isVisible}
        animationType="none" // We handle animation ourselves
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        {/* Scrim */}
        <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss} />
        </Animated.View>

        {/* Sheet */}
        <AppView style={styles.sheetAnchor} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: colors.card },
              sheetAnimStyle,
            ]}
          >
            {/* Handle bar */}
            <AppView
              style={[styles.handle, { backgroundColor: colors.border }]}
            />

            {/* Icon */}
            <AppView
              style={[styles.iconBadge, { backgroundColor: cfg.iconBg }]}
            >
              <Icon name={cfg.icon} size={26} color={cfg.iconColor} />
            </AppView>

            {/* Text */}
            <AppText variant="headline" style={styles.title}>
              {cfg.title}
            </AppText>

            <AppText
              variant="body"
              style={[styles.body, { color: colors.muted }]}
            >
              {cfg.body}
            </AppText>

            {/* Dev error */}
            {__DEV__ && !!errorMessage && (
              <AppText style={[styles.devError, { color: cfg.iconColor }]}>
                {errorMessage}
              </AppText>
            )}

            {/* Primary CTA */}
            <Pressable style={primaryPressStyle} onPress={handlePrimary}>
              <AppView
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              >
                <AppText style={styles.primaryBtnText}>
                  {cfg.primaryLabel}
                </AppText>
              </AppView>
            </Pressable>

            {/* Secondary */}
            {!!cfg.secondaryLabel && (
              <Pressable style={secondaryPressStyle} onPress={handleDismiss}>
                <AppText
                  style={[styles.secondaryLabel, { color: colors.muted }]}
                >
                  {cfg.secondaryLabel}
                </AppText>
              </Pressable>
            )}
          </Animated.View>
        </AppView>
      </Modal>
    );
  },
);

HealthGate.displayName = 'HealthGate';

// ─── resolveHealthGateReason ──────────────────────────────────────────────────
//
// Maps the exact return values of useHealth to a HealthGateReason.
// Only uses fields that useHealth actually exposes:
//   platform: 'healthkit' | 'healthconnect' | 'unavailable'
//   isReady:  boolean
//   error:    string | null
//
// Usage:
//   const reason = resolveHealthGateReason({ platform, isReady, error });
//   <HealthGate reason={reason} onRetry={refresh} onDismiss={() => setGate(null)} />

export function resolveHealthGateReason({
  platform,
  isReady,
  error,
}: {
  platform: HealthPlatform;
  isReady: boolean;
  error: string | null;
}): HealthGateReason | null {
  // Android: useHealth sets this exact message when HC is not installed
  if (
    platform === 'unavailable' &&
    error?.toLowerCase().includes('health connect')
  ) {
    return 'health-connect-missing';
  }

  // iOS: HealthKit init failed due to permissions
  if (platform === 'unavailable' || (!isReady && platform === 'healthkit')) {
    const lower = error?.toLowerCase() ?? '';
    if (lower.includes('denied') || lower.includes('permission')) {
      return 'healthkit-denied';
    }
  }

  // Any other error (network, parse, write failures)
  if (error) return 'error';

  // Platform stayed 'unavailable' with no specific error
  if (platform === 'unavailable') return 'not-ready';

  // isReady=false but no error — still initialising, handled by loading spinner
  return null;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetAnchor: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    alignItems: 'center',
    gap: 12,
    minHeight: SHEET_HEIGHT,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
    opacity: 0.35,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
  },
  devError: {
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.7,
  },
  primaryBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
});
