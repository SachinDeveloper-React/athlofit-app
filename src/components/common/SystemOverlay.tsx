import React, { useEffect, useRef, useState } from 'react';
import { View, Modal, Animated, Easing, StatusBar } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import AnimatedRN, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSystemStore } from '../../store/systemStore';
import { useTheme } from '../../hooks/useTheme';
import { makeStyles } from '../../hooks/makeStyles';
import AppText from '../AppText';
import Button from '../Button';
import { Icon } from '../Icon';
import { BASE_URL } from '../../utils/api';

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  // ── Maintenance ────────────────────────────────────────────────────────────
  maintenanceContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing[8],
  },
  maintenanceTitle: { marginTop: spacing[6], marginBottom: spacing[2], textAlign: 'center' as const },
  maintenanceBody:  { textAlign: 'center' as const, lineHeight: 24 },

  // ── Server unreachable ─────────────────────────────────────────────────────
  errorPage: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[8],
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[6],
  },
  errorCode: {
    marginBottom: spacing[1],
    letterSpacing: 3,
    textAlign: 'center' as const,
  },
  errorTitle: {
    marginBottom: spacing[3],
    textAlign: 'center' as const,
  },
  errorBody: {
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: spacing[8],
    maxWidth: 300,
  },
  buttonRow: {
    flexDirection: 'row' as const,
    gap: spacing[3],
  },
  divider: {
    width: 40,
    height: 3,
    borderRadius: radius.full,
    marginVertical: spacing[6],
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    marginTop: spacing[4],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Offline banner ─────────────────────────────────────────────────────────
  offlineBanner: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingTop: spacing[3],
    paddingHorizontal: spacing[4],
    gap: spacing[3],
    zIndex: 99999,
  },
  offlineText: {
    color: '#fff',
    fontWeight: fontWeight.semiBold,
    fontSize: fontSize.md,
  },
}));

// ─── Pulsing dot animation ────────────────────────────────────────────────────

function PulsingDot({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.6, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1,   duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1,   duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

// ─── Server Unreachable page ──────────────────────────────────────────────────

function ServerErrorPage({
  onRetry,
  retrying,
}: {
  onRetry: () => void;
  retrying: boolean;
}) {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.errorPage,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing[4],
          paddingBottom: insets.bottom + spacing[6],
        },
      ]}
    >
      <StatusBar
        barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />

      {/* Icon circle */}
      <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}18` }]}>
        <Icon name="ServerCrash" size={44} color={colors.primary} />
      </View>

      {/* Error code */}
      <AppText
        variant="caption1"
        weight="bold"
        style={[styles.errorCode, { color: colors.mutedForeground }]}
      >
        CONNECTION ERROR
      </AppText>

      {/* Title */}
      <AppText variant="title2" weight="bold" style={styles.errorTitle}>
        Can't reach the server
      </AppText>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Body */}
      <AppText variant="body" secondary style={styles.errorBody}>
        We're having trouble connecting to Athlofit's servers. This could be a
        temporary outage or a network issue on your end.
      </AppText>

      {/* Actions */}
      <View style={styles.buttonRow}>
        <Button
          label={retrying ? 'Retrying…' : 'Try again'}
          onPress={onRetry}
          disabled={retrying}
          style={{ paddingHorizontal: spacing[6] }}
        />
      </View>

      {/* Status indicator */}
      <View style={styles.statusRow}>
        <PulsingDot color={retrying ? colors.warning : colors.destructive} />
        <AppText variant="caption1" secondary>
          {retrying ? 'Checking connection…' : 'Server unreachable'}
        </AppText>
      </View>
    </View>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

const SystemOverlay = () => {
  const { colors, spacing } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isMaintenance, setMaintenance, isServerUnreachable, setServerUnreachable } =
    useSystemStore();
  const netInfo = useNetInfo();
  const [polling, setPolling]   = useState(false);
  const [retrying, setRetrying] = useState(false);

  const isOffline = netInfo.isConnected === false;

  // ── Maintenance polling ───────────────────────────────────────────────────
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isMaintenance) {
      interval = setInterval(async () => {
        try {
          setPolling(true);
          const res  = await fetch(BASE_URL);
          const data = await res.json();
          if (data?.success && !data.isMaintenance) setMaintenance(false);
        } catch { /* keep polling */ } finally { setPolling(false); }
      }, 10_000);
    }
    return () => clearInterval(interval);
  }, [isMaintenance, setMaintenance]);

  // ── Auto-retry when server was unreachable ────────────────────────────────
  // Poll every 15 s in the background so the modal dismisses automatically
  // once the server comes back, without the user having to tap anything.
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isServerUnreachable) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(BASE_URL, { method: 'HEAD' });
          if (res.ok || res.status < 500) {
            setServerUnreachable(false);
          }
        } catch { /* still down */ }
      }, 15_000);
    }
    return () => clearInterval(interval);
  }, [isServerUnreachable, setServerUnreachable]);

  // ── Manual retry handler ──────────────────────────────────────────────────
  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(BASE_URL, { method: 'HEAD' });
      if (res.ok || res.status < 500) {
        setServerUnreachable(false);
      }
    } catch { /* still down */ } finally {
      setRetrying(false);
    }
  };

  return (
    <>
      {/* ── Maintenance modal ─────────────────────────────────────────────── */}
      <Modal visible={isMaintenance} animationType="fade" transparent={false}>
        <View
          style={[
            styles.maintenanceContainer,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top + spacing[4],
              paddingBottom: insets.bottom + spacing[4],
            },
          ]}
        >
          <StatusBar
            barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'}
            backgroundColor={colors.background}
          />
          <Icon name="Wrench" size={64} color={colors.primary} />
          <AppText variant="title1" style={styles.maintenanceTitle}>We'll be back soon!</AppText>
          <AppText variant="body" secondary style={styles.maintenanceBody}>
            The system is currently undergoing scheduled maintenance. Please check back in a little while.
          </AppText>
          <Button
            label={polling ? 'Checking status…' : 'Try again manually'}
            variant="outline"
            onPress={() => {}}
            disabled={polling}
            style={{ marginTop: spacing[6], paddingVertical: spacing[3] }}
          />
        </View>
      </Modal>

      {/* ── Server unreachable modal ──────────────────────────────────────── */}
      <Modal
        visible={isServerUnreachable && !isMaintenance}
        animationType="fade"
        transparent={false}
      >
        <ServerErrorPage onRetry={handleRetry} retrying={retrying} />
      </Modal>

      {/* ── Offline banner (slide up from bottom) ────────────────────────── */}
      {isOffline && (
        <AnimatedRN.View
          entering={SlideInDown.duration(400)}
          exiting={SlideOutDown.duration(400)}
          style={[
            styles.offlineBanner,
            {
              backgroundColor: colors.destructive,
              // Replace the static paddingBottom with the real inset so the
              // banner content sits above the home indicator / nav bar.
              paddingBottom: Math.max(insets.bottom, spacing[3]),
            },
          ]}
        >
          <Icon name="WifiOff" size={20} color="#fff" />
          <AppText style={styles.offlineText} variant="subhead">No Internet Connection</AppText>
        </AnimatedRN.View>
      )}
    </>
  );
};

export default SystemOverlay;
