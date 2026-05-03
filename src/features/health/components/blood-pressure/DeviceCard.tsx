// src/features/health/components/blood-pressure/DeviceCard.tsx
import React, { memo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { State, Device } from 'react-native-ble-plx';
import {
  Bluetooth,
  BluetoothOff,
  BluetoothSearching,
  CheckCircle2,
  MapPin,
  Radio,
  Settings,
  ShieldCheck,
  Wifi,
} from 'lucide-react-native';

import { AppText, AppView, Button, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { makeStyles } from '../../../../hooks/makeStyles';
import { PulseRing } from './PulseRing';
import type { BluetoothPermissionStatus } from '../../hooks/useBluetooth';

// ─── Required BT permissions list ────────────────────────────────────────────

interface BtPermission {
  icon: typeof Bluetooth;
  iconColor: string;
  label: string;
  description: string;
  platform: 'android' | 'ios' | 'both';
}

const BT_PERMISSIONS: BtPermission[] = [
  {
    icon: BluetoothSearching,
    iconColor: '#0099FF',
    label: 'Bluetooth Scan',
    description: 'Discover nearby blood pressure monitors',
    platform: 'android',
  },
  {
    icon: Bluetooth,
    iconColor: '#8B5CF6',
    label: 'Bluetooth Connect',
    description: 'Pair and connect to your BP device',
    platform: 'android',
  },
  {
    icon: MapPin,
    iconColor: '#10B981',
    label: 'Location (Nearby Devices)',
    description: 'Required by Android to scan for BLE devices',
    platform: 'android',
  },
  {
    icon: Radio,
    iconColor: '#F97316',
    label: 'Bluetooth',
    description: 'Scan and connect to nearby BLE devices',
    platform: 'ios',
  },
];

// ─── Permission denied UI ─────────────────────────────────────────────────────

interface PermissionDeniedProps {
  onRequest: () => void;
  isRequesting: boolean;
}

const PermissionDeniedView = memo(({ onRequest, isRequesting }: PermissionDeniedProps) => {
  const { colors, isDark } = useTheme();
  const accentColor = '#0099FF';

  const visiblePerms = BT_PERMISSIONS.filter(p =>
    p.platform === 'both' ||
    (Platform.OS === 'android' && p.platform === 'android') ||
    (Platform.OS === 'ios' && p.platform === 'ios'),
  );

  const openSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  return (
    <View style={styles.permContainer}>
      {/* Icon */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.permIconWrap}>
        <View style={[styles.permIconOuter, { backgroundColor: withOpacity(accentColor, 0.08) }]}>
          <View style={[styles.permIconInner, { backgroundColor: withOpacity(accentColor, 0.15) }]}>
            <ShieldCheck size={32} color={accentColor} />
          </View>
        </View>
      </Animated.View>

      {/* Title */}
      <Animated.View entering={FadeInDown.delay(60).duration(350)} style={styles.permTextWrap}>
        <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground, textAlign: 'center' }}>
          Bluetooth Permission Required
        </AppText>
        <AppText
          variant="subhead"
          style={{ color: colors.mutedForeground, textAlign: 'center', lineHeight: 20, marginTop: 6 }}
        >
          To scan for your blood pressure monitor, Athlofit needs the following permissions:
        </AppText>
      </Animated.View>

      {/* Permissions list */}
      <Animated.View
        entering={FadeInDown.delay(120).duration(350)}
        style={[
          styles.permList,
          {
            backgroundColor: isDark ? withOpacity(accentColor, 0.07) : withOpacity(accentColor, 0.04),
            borderColor: withOpacity(accentColor, 0.18),
          },
        ]}
      >
        <AppText
          variant="caption1"
          weight="semiBold"
          style={{ color: accentColor, marginBottom: 10, letterSpacing: 0.5 }}
        >
          REQUIRED PERMISSIONS
        </AppText>

        {visiblePerms.map((perm, i) => {
          const { icon: Icon } = perm;
          return (
            <Animated.View
              key={perm.label}
              entering={FadeInDown.delay(180 + i * 60).duration(300)}
              style={[
                styles.permRow,
                i < visiblePerms.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: withOpacity(accentColor, 0.12) },
              ]}
            >
              <View style={[styles.permRowIcon, { backgroundColor: withOpacity(perm.iconColor, 0.12) }]}>
                <Icon size={15} color={perm.iconColor} />
              </View>
              <View style={styles.permRowText}>
                <AppText variant="subhead" weight="semiBold" style={{ color: colors.foreground }}>
                  {perm.label}
                </AppText>
                <AppText variant="caption1" style={{ color: colors.mutedForeground, marginTop: 1, lineHeight: 16 }}>
                  {perm.description}
                </AppText>
              </View>
            </Animated.View>
          );
        })}
      </Animated.View>

      {/* Buttons */}
      <Animated.View entering={FadeInDown.delay(400).duration(350)} style={styles.permButtons}>
        <TouchableOpacity
          onPress={onRequest}
          disabled={isRequesting}
          activeOpacity={0.85}
          style={[styles.allowBtn, { backgroundColor: accentColor, opacity: isRequesting ? 0.7 : 1 }]}
        >
          {isRequesting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={styles.btnRow}>
              <Bluetooth size={16} color="#fff" style={{ marginRight: 8 }} />
              <AppText variant="headline" weight="semiBold" style={{ color: '#fff' }}>
                Allow Bluetooth
              </AppText>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openSettings}
          activeOpacity={0.7}
          style={[styles.settingsBtn, { borderColor: withOpacity(accentColor, 0.3), backgroundColor: withOpacity(accentColor, 0.06) }]}
        >
          <Settings size={14} color={accentColor} style={{ marginRight: 6 }} />
          <AppText variant="subhead" weight="semiBold" style={{ color: accentColor }}>
            Open Settings
          </AppText>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});
PermissionDeniedView.displayName = 'PermissionDeniedView';

// ─── Bluetooth off UI ─────────────────────────────────────────────────────────

const BluetoothOffView = memo(() => {
  const { colors } = useTheme();
  return (
    <View style={styles.centeredState}>
      <View style={[styles.stateIconWrap, { backgroundColor: withOpacity('#6B7280', 0.1) }]}>
        <BluetoothOff size={32} color="#6B7280" />
      </View>
      <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground, marginTop: 12 }}>
        Bluetooth is Off
      </AppText>
      <AppText variant="subhead" style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
        Please enable Bluetooth in your device settings to scan for blood pressure monitors.
      </AppText>
    </View>
  );
});
BluetoothOffView.displayName = 'BluetoothOffView';

// ─── Ready to scan UI ─────────────────────────────────────────────────────────

interface ReadyToScanProps {
  scanning: boolean;
  connecting: boolean;
  onScan: () => void;
}

const ReadyToScanView = memo(({ scanning, connecting, onScan }: ReadyToScanProps) => {
  const { colors } = useTheme();
  return (
    <View style={styles.centeredState}>
      <View style={[styles.stateIconWrap, { backgroundColor: withOpacity('#0099FF', 0.1) }]}>
        <BluetoothSearching size={32} color="#0099FF" />
      </View>
      <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground, marginTop: 12 }}>
        Scan for Device
      </AppText>
      <AppText
        variant="subhead"
        style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 6, lineHeight: 20, marginBottom: 20 }}
      >
        Connect a BLE blood pressure monitor that supports the Bluetooth Blood Pressure Profile (BLP).
      </AppText>

      {/* Supported devices hint */}
      <View style={[styles.hintCard, { backgroundColor: withOpacity('#0099FF', 0.06), borderColor: withOpacity('#0099FF', 0.15) }]}>
        <AppText variant="caption1" weight="semiBold" style={{ color: '#0099FF', marginBottom: 6 }}>
          COMPATIBLE DEVICES
        </AppText>
        {['Omron BLE monitors', 'Withings BPM Connect', 'Any BLP-compatible device'].map((d, i) => (
          <View key={i} style={styles.hintRow}>
            <CheckCircle2 size={12} color="#0099FF" />
            <AppText variant="caption1" style={{ color: colors.mutedForeground, marginLeft: 6 }}>
              {d}
            </AppText>
          </View>
        ))}
      </View>

      <Button
        label={scanning ? 'Scanning…' : 'Scan for Devices'}
        onPress={onScan}
        variant="primary"
        size="lg"
        fullWidth
        loading={scanning}
        disabled={connecting}
        style={{ marginTop: 16 }}
      />
    </View>
  );
});
ReadyToScanView.displayName = 'ReadyToScanView';

// ─── Connected device UI ──────────────────────────────────────────────────────

interface ConnectedProps {
  device: Device;
  waitingForMeasurement: boolean;
  onDisconnect: () => void;
}

const ConnectedView = memo(({ device, waitingForMeasurement, onDisconnect }: ConnectedProps) => {
  const { colors } = useTheme();
  return (
    <View style={styles.centeredState}>
      {/* Device name */}
      <View style={styles.connectedHeader}>
        <View style={[styles.connectedDot, { backgroundColor: '#22c55e' }]} />
        <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground }}>
          {device.name ?? 'BLE Device'}
        </AppText>
      </View>

      {waitingForMeasurement ? (
        <View style={styles.waitingWrap}>
          <View style={styles.pulseWrap}>
            <PulseRing color="#ef4444" active />
            <AppText style={styles.heartEmoji}>❤️</AppText>
          </View>
          <AppText variant="headline" weight="semiBold" style={{ color: colors.foreground, marginTop: 20 }}>
            Waiting for measurement…
          </AppText>
          <AppText variant="subhead" style={{ color: colors.mutedForeground, marginTop: 6, textAlign: 'center' }}>
            Press the start button on your device.
          </AppText>
        </View>
      ) : (
        <View style={[styles.receivedBadge, { backgroundColor: withOpacity('#22c55e', 0.1) }]}>
          <CheckCircle2 size={18} color="#22c55e" />
          <AppText variant="subhead" weight="semiBold" style={{ color: '#22c55e', marginLeft: 8 }}>
            Reading received
          </AppText>
        </View>
      )}

      <Button
        label="Disconnect"
        onPress={onDisconnect}
        variant="outline"
        size="md"
        fullWidth
        style={{ marginTop: 20 }}
      />
    </View>
  );
});
ConnectedView.displayName = 'ConnectedView';

// ─── Main DeviceCard ──────────────────────────────────────────────────────────

interface DeviceCardProps {
  bleState: State;
  permissionStatus: BluetoothPermissionStatus;
  scanning: boolean;
  connecting: boolean;
  connectedDevice: Device | null;
  waitingForMeasurement: boolean;
  onScan: () => void;
  onDisconnect: () => void;
  onRequestPermission: () => Promise<boolean>;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  bleState,
  permissionStatus,
  scanning,
  connecting,
  connectedDevice,
  waitingForMeasurement,
  onScan,
  onDisconnect,
  onRequestPermission,
}) => {
  const [isRequesting, setIsRequesting] = React.useState(false);

  const handleRequestPermission = async () => {
    setIsRequesting(true);
    try {
      await onRequestPermission();
    } finally {
      setIsRequesting(false);
    }
  };

  const renderContent = () => {
    // 1. Permission not granted
    if (permissionStatus === 'denied') {
      return (
        <PermissionDeniedView
          onRequest={handleRequestPermission}
          isRequesting={isRequesting}
        />
      );
    }

    // 2. Bluetooth is off
    if (bleState !== State.PoweredOn && bleState !== State.Unknown) {
      return <BluetoothOffView />;
    }

    // 3. Connected to a device
    if (connectedDevice) {
      return (
        <ConnectedView
          device={connectedDevice}
          waitingForMeasurement={waitingForMeasurement}
          onDisconnect={onDisconnect}
        />
      );
    }

    // 4. Ready to scan
    return (
      <ReadyToScanView
        scanning={scanning}
        connecting={connecting}
        onScan={onScan}
      />
    );
  };

  return (
    <Card style={styles.card}>
      <AppText variant="headline" style={styles.cardTitle}>
        Bluetooth Device
      </AppText>
      {renderContent()}
    </Card>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  cardTitle: { marginBottom: 16 },

  // ── Permission denied ──
  permContainer: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 4,
  },
  permIconWrap: { alignItems: 'center' },
  permIconOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTextWrap: { alignItems: 'center', paddingHorizontal: 4 },
  permList: {
    width: '100%',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  permRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  permRowText: { flex: 1 },
  permButtons: { width: '100%', gap: 10 },
  allowBtn: {
    width: '100%',
    height: 50,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  settingsBtn: {
    width: '100%',
    height: 46,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: { flexDirection: 'row', alignItems: 'center' },

  // ── Shared centered state ──
  centeredState: {
    alignItems: 'center',
    paddingVertical: 8,
    width: '100%',
  },
  stateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Ready to scan ──
  hintCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },

  // ── Connected ──
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  connectedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  waitingWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  pulseWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartEmoji: {
    fontSize: 40,
    textAlign: 'center',
  },
  receivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
});
