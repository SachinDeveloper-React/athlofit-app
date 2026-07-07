
import React, { memo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  Activity,
  Droplets,
  ExternalLink,
  Flame,
  Heart,
  HeartPulse,
  MapPin,
  RefreshCw,
  ShieldOff,
  Footprints,
  Scale,
  Zap,
} from 'lucide-react-native';

import { AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { initializeHealthKit } from '../../service/healthkit.service';
import { setHealthPreference } from '../../service/healthPreference.service';

// Health Connect is Android-only — lazy-import to avoid crashing on iOS
// where the native module proxy throws on property access.
const getHealthConnectService = () =>
  require('../../service/healthConnect.service') as {
    initializeHealthConnect: () => Promise<boolean>;
    isHealthConnectAvailable: () => Promise<boolean>;
  };

// ─── Constants ────────────────────────────────────────────────────────────────

const HEALTH_CONNECT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const IOS_SETTINGS_URL = 'app-settings:';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PermissionScenario =
  | 'android-missing'
  | 'android-denied'
  | 'ios-denied'
  | 'error';

interface Props {
  scenario: PermissionScenario;
  errorMessage?: string;
  onPermissionGranted: () => void;
  onSkip?: () => void;
}

// ─── Required permissions list ────────────────────────────────────────────────
// Shown to the user so they know exactly what they're granting and why.

interface PermissionItem {
  Icon: typeof Heart;
  iconColor: string;
  label: string;
  reason: string;
  access: 'Read' | 'Read & Write';
}

const REQUIRED_PERMISSIONS: PermissionItem[] = [
  {
    Icon: Footprints,
    iconColor: '#0099FF',
    label: 'Steps',
    reason: 'Track your daily step count and progress toward your goal',
    access: 'Read & Write',
  },
  {
    Icon: Flame,
    iconColor: '#F97316',
    label: 'Active Calories',
    reason: 'Calculate calories burned from your activity',
    access: 'Read & Write',
  },
  {
    Icon: MapPin,
    iconColor: '#10B981',
    label: 'Distance',
    reason: 'Measure how far you walk or run each day',
    access: 'Read & Write',
  },
  {
    Icon: Activity,
    iconColor: '#F59E0B',
    label: 'Exercise Sessions',
    reason: 'Log your active minutes and workout sessions',
    access: 'Read & Write',
  },
  {
    Icon: Heart,
    iconColor: '#EF4444',
    label: 'Heart Rate',
    reason: 'Monitor your resting and active heart rate',
    access: 'Read & Write',
  },
  {
    Icon: Zap,
    iconColor: '#8B5CF6',
    label: 'Blood Pressure',
    reason: 'Track systolic and diastolic blood pressure readings',
    access: 'Read & Write',
  },
  {
    Icon: Scale,
    iconColor: '#6366F1',
    label: 'Weight',
    reason: 'Track body weight changes and BMI calculations',
    access: 'Read & Write',
  },
  {
    Icon: Droplets,
    iconColor: '#06B6D4',
    label: 'Hydration',
    reason: 'Track daily water intake toward your hydration goal',
    access: 'Read & Write',
  },
];

// ─── Scenario config ──────────────────────────────────────────────────────────

interface ScenarioConfig {
  HeaderIcon: typeof ShieldOff;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

const CONFIGS: Record<PermissionScenario, ScenarioConfig> = {
  'android-missing': {
    HeaderIcon: HeartPulse,
    iconColor: '#D85A30',
    iconBg: '#FAECE7',
    title: 'Health Connect Required',
    description:
      'Athlofit uses Health Connect to read your activity data. ' +
      'Install it from the Play Store, then return here to grant access.',
    primaryLabel: 'Install Health Connect',
    secondaryLabel: 'Try Again',
  },
  'android-denied': {
    HeaderIcon: ShieldOff,
    iconColor: '#185FA5',
    iconBg: '#E6F1FB',
    title: 'Permission Not Granted',
    description:
      'Athlofit needs the following Health Connect permissions to track your health and fitness data.',
    primaryLabel: 'Allow Permission',
    secondaryLabel: 'Open Settings',
  },
  'ios-denied': {
    HeaderIcon: ShieldOff,
    iconColor: '#185FA5',
    iconBg: '#E6F1FB',
    title: 'Health Access Denied',
    description:
      'Athlofit needs the following Health permissions to track your fitness data.',
    primaryLabel: 'Allow Permission',
    secondaryLabel: 'Open Settings',
  },
  'error': {
    HeaderIcon: RefreshCw,
    iconColor: '#A32D2D',
    iconBg: '#FCEBEB',
    title: 'Could Not Connect',
    description:
      'We could not connect to your health data. Make sure Health Connect is installed and permissions are granted.',
    primaryLabel: 'Try Again',
  },
};

// ─── Permission row ───────────────────────────────────────────────────────────

const PermissionRow = memo(({
  item,
  index,
  accentColor,
}: {
  item: PermissionItem;
  index: number;
  accentColor: string;
}) => {
  const { colors } = useTheme();
  const { Icon } = item;

  return (
    <Animated.View
      entering={FadeInDown.delay(250 + index * 50).duration(300)}
      style={[styles.permRow, { borderBottomColor: colors.border }]}
    >
      {/* Icon */}
      <View style={[styles.permIcon, { backgroundColor: withOpacity(item.iconColor, 0.12) }]}>
        <Icon size={16} color={item.iconColor} />
      </View>

      {/* Text */}
      <View style={styles.permText}>
        <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
          {item.label}
        </AppText>
        <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 1, lineHeight: 16 }}>
          {item.reason}
        </AppText>
      </View>

      {/* Access badge */}
      <View style={[styles.accessBadge, { backgroundColor: withOpacity(accentColor, 0.1) }]}>
        <AppText variant="caption2" weight="semiBold" style={{ color: accentColor, fontSize: 9 }}>
          {item.access}
        </AppText>
      </View>
    </Animated.View>
  );
});
PermissionRow.displayName = 'PermissionRow';

// ─── Main component ───────────────────────────────────────────────────────────

const PermissionDeniedScreen = memo(({ scenario, errorMessage, onPermissionGranted, onSkip }: Props) => {
  const { colors, isDark } = useTheme();
  const [isRequesting, setIsRequesting] = useState(false);
  const denialCountRef = useRef(0);
  const cfg = CONFIGS[scenario];
  const { HeaderIcon } = cfg;

  // Show permission list only for denied scenarios (not missing/error)
  const showPermissions = scenario === 'android-denied' || scenario === 'ios-denied';

  // ── Primary action ────────────────────────────────────────────────────────
  const showOpenSettingsAlert = () => {
    const platformName = Platform.OS === 'ios' ? 'Health' : 'Health Connect';
    Alert.alert(
      'Permission Required',
      `You have denied ${platformName} access. Please open Settings and grant the required permissions manually.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL(IOS_SETTINGS_URL);
            } else {
              Linking.openURL('package:com.google.android.apps.healthdata').catch(() =>
                Linking.openSettings(),
              );
            }
          },
        },
      ],
    );
  };

  const handlePrimary = async () => {
    setIsRequesting(true);
    try {
      if (scenario === 'android-missing') {
        await Linking.openURL(HEALTH_CONNECT_STORE_URL);
      } else if (scenario === 'android-denied') {
        // If user already denied once from this screen, go straight to settings alert
        if (denialCountRef.current >= 1) {
          showOpenSettingsAlert();
          return;
        }

        const { isHealthConnectAvailable, initializeHealthConnect } = getHealthConnectService();
        const available = await isHealthConnectAvailable();
        if (!available) {
          await Linking.openURL(HEALTH_CONNECT_STORE_URL);
          return;
        }
        const granted = await initializeHealthConnect();
        if (granted) {
          setHealthPreference('connected');
          onPermissionGranted();
        } else {
          // Permission denied — track and show settings alert
          denialCountRef.current += 1;
          showOpenSettingsAlert();
        }
      } else if (scenario === 'ios-denied') {
        // On iOS, HealthKit only shows the permission dialog once per app install.
        // After that, requestAuthorization resolves silently. Try it — if the user
        // hasn't interacted with the dialog yet, it will show. If they already
        // denied, open the Health app settings so they can toggle permissions.
        const granted = await initializeHealthKit();
        if (granted) {
          setHealthPreference('connected');
          onPermissionGranted();
        } else {
          // Permission denied — show settings alert
          showOpenSettingsAlert();
        }
      } else {
        onPermissionGranted();
      }
    } catch {
      // silent — user may have cancelled
    } finally {
      setIsRequesting(false);
    }
  };

  // ── Secondary action ──────────────────────────────────────────────────────
  const handleSecondary = async () => {
    setIsRequesting(true);
    try {
      if (scenario === 'android-missing') {
        // "Try Again" after installing
        const { initializeHealthConnect } = getHealthConnectService();
        const granted = await initializeHealthConnect();
        if (granted) {
          setHealthPreference('connected');
          onPermissionGranted();
        }
      } else if (scenario === 'android-denied') {
        // "Open Settings" → Health Connect app settings
        await Linking.openURL('package:com.google.android.apps.healthdata').catch(() =>
          Linking.openURL(HEALTH_CONNECT_STORE_URL),
        );
      } else if (scenario === 'ios-denied') {
        // "Open Settings" → iOS Health app settings
        await Linking.openURL(IOS_SETTINGS_URL);
      }
    } catch {
      // silent
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {/* ── Header icon ── */}
      <Animated.View entering={FadeInUp.duration(400)} style={styles.iconSection}>
        <View style={[styles.iconOuter, { backgroundColor: withOpacity(cfg.iconColor, 0.08) }]}>
          <View style={[styles.iconInner, { backgroundColor: cfg.iconBg }]}>
            <HeaderIcon size={36} color={cfg.iconColor} />
          </View>
        </View>
      </Animated.View>

      {/* ── Title + description ── */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.textSection}>
        <AppText
          variant="title2"
          weight="bold"
          style={{ color: colors.foreground, textAlign: 'center' }}
        >
          {cfg.title}
        </AppText>
        <AppText
          variant="subhead"
          style={{ color: colors.mutedForeground, textAlign: 'center', lineHeight: 22, marginTop: 10 }}
        >
          {cfg.description}
        </AppText>
      </Animated.View>

      {/* ── Required permissions list ── */}
      {showPermissions && (
        <Animated.View
          entering={FadeInDown.delay(160).duration(400)}
          style={[
            styles.permCard,
            {
              backgroundColor: isDark ? colors.card : colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Card header */}
          <View style={styles.permCardHeader}>
            <AppText
              variant="caption1"
              weight="semiBold"
              style={{ color: cfg.iconColor, letterSpacing: 0.6 }}
            >
              REQUIRED PERMISSIONS
            </AppText>
            <View style={[styles.countBadge, { backgroundColor: withOpacity(cfg.iconColor, 0.12) }]}>
              <AppText variant="caption2" weight="bold" style={{ color: cfg.iconColor }}>
                {REQUIRED_PERMISSIONS.length}
              </AppText>
            </View>
          </View>

          {/* Permission rows */}
          {REQUIRED_PERMISSIONS.map((item, i) => (
            <PermissionRow
              key={item.label}
              item={item}
              index={i}
              accentColor={cfg.iconColor}
            />
          ))}
        </Animated.View>
      )}

      {/* ── Install steps (for missing scenario) ── */}
      {scenario === 'android-missing' && (
        <Animated.View
          entering={FadeInDown.delay(160).duration(400)}
          style={[
            styles.stepsCard,
            {
              backgroundColor: withOpacity(cfg.iconColor, isDark ? 0.07 : 0.04),
              borderColor: withOpacity(cfg.iconColor, 0.18),
            },
          ]}
        >
          <AppText
            variant="caption1"
            weight="semiBold"
            style={{ color: cfg.iconColor, marginBottom: 10, letterSpacing: 0.5 }}
          >
            HOW TO SET UP
          </AppText>
          {[
            'Tap "Install Health Connect" below',
            'Install the app from the Play Store',
            'Return here and tap "Try Again"',
          ].map((step, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(280 + i * 70).duration(300)}
              style={styles.stepRow}
            >
              <View style={[styles.stepNum, { backgroundColor: withOpacity(cfg.iconColor, 0.15) }]}>
                <AppText style={{ fontSize: 11, fontWeight: '700', color: cfg.iconColor, lineHeight: 16 }}>
                  {i + 1}
                </AppText>
              </View>
              <AppText variant="subhead" style={{ color: colors.foreground, flex: 1, lineHeight: 20 }}>
                {step}
              </AppText>
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {/* ── Dev error ── */}
      {__DEV__ && !!errorMessage && (
        <Animated.View entering={FadeInDown.delay(350).duration(300)}>
          <AppText
            variant="caption2"
            style={{ color: colors.destructive, textAlign: 'center', paddingHorizontal: 24, opacity: 0.7 }}
          >
            {errorMessage}
          </AppText>
        </Animated.View>
      )}

      {/* ── Buttons ── */}
      <Animated.View
        entering={FadeInDown.delay(400).duration(400)}
        style={styles.buttonSection}
      >
        {/* Primary CTA */}
        <TouchableOpacity
          onPress={handlePrimary}
          disabled={isRequesting}
          activeOpacity={0.85}
          style={[
            styles.primaryBtn,
            { backgroundColor: cfg.iconColor, opacity: isRequesting ? 0.7 : 1 },
          ]}
        >
          {isRequesting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.btnContent}>
              {(scenario === 'android-missing' || scenario === 'ios-denied') && (
                <ExternalLink size={16} color="#fff" style={{ marginRight: 8 }} />
              )}
              <AppText variant="headline" weight="semiBold" style={{ color: '#fff' }}>
                {cfg.primaryLabel}
              </AppText>
            </View>
          )}
        </TouchableOpacity>

        {/* Secondary */}
        {cfg.secondaryLabel && (
          <TouchableOpacity
            onPress={handleSecondary}
            disabled={isRequesting}
            activeOpacity={0.7}
            style={[
              styles.secondaryBtn,
              {
                borderColor: withOpacity(cfg.iconColor, 0.3),
                backgroundColor: withOpacity(cfg.iconColor, 0.06),
              },
            ]}
          >
            <AppText variant="subhead" weight="semiBold" style={{ color: cfg.iconColor }}>
              {cfg.secondaryLabel}
            </AppText>
          </TouchableOpacity>
        )}

        {/* Skip — continue without full health data */}
        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            disabled={isRequesting}
            activeOpacity={0.7}
            style={styles.skipBtn}
          >
            <AppText variant="subhead" style={{ color: colors.mutedForeground }}>
              {Platform.OS === 'ios' ? 'Skip for Now' : 'Continue with Steps Only'}
            </AppText>
          </TouchableOpacity>
        )}
      </Animated.View>
    </ScrollView>
  );
});

PermissionDeniedScreen.displayName = 'PermissionDeniedScreen';
export default PermissionDeniedScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    // paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },
  iconSection: {
    alignItems: 'center',
  },
  iconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  // ── Permission card ──
  permCard: {
    width: '100%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  permCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  permIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  permText: {
    flex: 1,
  },
  accessBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    flexShrink: 0,
  },
  // ── Steps card (install scenario) ──
  stepsCard: {
    width: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 6,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  // ── Buttons ──
  buttonSection: {
    width: '100%',
    gap: 12,
    marginTop: 4,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
});
