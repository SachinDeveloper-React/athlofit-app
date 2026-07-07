// src/features/health/components/tracker/HealthGate.tsx
import React, { memo, useCallback, useEffect } from 'react';
import {
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { AppText, AppView, Button } from '../../../../components';
import { type HealthPlatform } from '../../hooks/useHealth';
import { Icon, LucideName } from '../../../../components/Icon';
import { useTheme } from '../../../../hooks/useTheme';
import { makeStyles } from '../../../../hooks/makeStyles';

export type HealthGateReason =
  | 'health-connect-missing'
  | 'healthkit-denied'
  | 'error'
  | 'not-ready';

type Props = {
  reason: HealthGateReason | null;
  errorMessage?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
};

const HEALTH_CONNECT_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const IOS_SETTINGS_URL = 'app-settings:';

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

const SHEET_HEIGHT = 360;

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  backdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetAnchor: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    paddingHorizontal: spacing[6],
    paddingBottom: 36,
    paddingTop: spacing[3],
    alignItems: 'center' as const,
    gap: spacing[3],
    minHeight: SHEET_HEIGHT,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: spacing[0.5],
    marginBottom: spacing[2],
    opacity: 0.35,
  },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: spacing[1],
  },
  title: {
    textAlign: 'center' as const,
  },
  body: {
    textAlign: 'center' as const,
    lineHeight: 22,
    fontSize: 14,
  },
  devError: {
    fontSize: 11,
    textAlign: 'center' as const,
    opacity: 0.7,
  },
  primaryBtn: {
    width: '100%' as const,
    paddingVertical: spacing[3.5 as any] ?? 14,
    borderRadius: radius.lg,
    alignItems: 'center' as const,
    marginTop: spacing[1],
  },
}));

export const HealthGate = memo(
  ({ reason, errorMessage, onRetry, onDismiss }: Props) => {
    const { colors } = useTheme();
    const styles = useStyles();

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    const isVisible = !!reason;
    const cfg = reason ? GATE_CONFIG[reason] : null;

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
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleDismiss}
      >
        <Animated.View style={[styles.backdrop, backdropAnimStyle]}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={handleDismiss} />
        </Animated.View>

        <AppView style={styles.sheetAnchor} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: colors.card },
              sheetAnimStyle,
            ]}
          >
            <AppView
              style={[styles.handle, { backgroundColor: colors.border }]}
            />

            <AppView
              style={[styles.iconBadge, { backgroundColor: cfg.iconBg }]}
            >
              <Icon name={cfg.icon} size={26} color={cfg.iconColor} />
            </AppView>

            <AppText variant="headline" style={styles.title}>
              {cfg.title}
            </AppText>

            <AppText
              variant="body"
              style={[styles.body, { color: colors.muted }]}
            >
              {cfg.body}
            </AppText>

            {__DEV__ && !!errorMessage && (
              <AppText style={[styles.devError, { color: cfg.iconColor }]}>
                {errorMessage}
              </AppText>
            )}

            <Button
              label={cfg.primaryLabel}
              onPress={handlePrimary}
              variant="primary"
              size="lg"
              fullWidth
              style={styles.primaryBtn}
            />

            {!!cfg.secondaryLabel && (
              <Button
                label={cfg.secondaryLabel}
                onPress={handleDismiss}
                variant="ghost"
                size="md"
              />
            )}
          </Animated.View>
        </AppView>
      </Modal>
    );
  },
);

HealthGate.displayName = 'HealthGate';

export function resolveHealthGateReason({
  platform,
  isReady,
  error,
}: {
  platform: HealthPlatform;
  isReady: boolean;
  error: string | null;
}): HealthGateReason | null {
  // native_sensor mode works independently — never show the gate
  if (platform === 'native_sensor') return null;

  if (
    platform === 'unavailable' &&
    error?.toLowerCase().includes('health connect')
  ) {
    return 'health-connect-missing';
  }

  if (platform === 'unavailable' || (!isReady && platform === 'healthkit')) {
    const lower = error?.toLowerCase() ?? '';
    if (lower.includes('denied') || lower.includes('permission')) {
      return 'healthkit-denied';
    }
  }

  if (error) return 'error';

  if (platform === 'unavailable') return 'not-ready';

  return null;
}
