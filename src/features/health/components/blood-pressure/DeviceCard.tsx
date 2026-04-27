import React from 'react';
import { State, Device } from 'react-native-ble-plx';
import { AppText, AppView, Button, Card, Loader } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { PulseRing } from './PulseRing';
import { makeStyles } from '../../../../hooks/makeStyles';

interface DeviceCardProps {
  bleState: State;
  scanning: boolean;
  connecting: boolean;
  connectedDevice: Device | null;
  waitingForMeasurement: boolean;
  onScan: () => void;
  onDisconnect: () => void;
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  card: { marginBottom: spacing[4] },
  title: { marginBottom: spacing[4] },
  illustration: { paddingVertical: spacing[5] },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    marginBottom: spacing[4],
  },
  icon: { fontSize: 36 },
  hint: { lineHeight: 20 },
  connectedBox: { width: '100%' as const },
  connectedHeader: { marginBottom: spacing[5] },
  dot: { width: 8, height: 8, borderRadius: radius.full },
  waitBox: { paddingVertical: spacing[5], gap: spacing[2] },
  heartIcon: { fontSize: 48, textAlign: 'center' as const },
  waitText: { marginTop: spacing[4] },
  readyText: { marginBottom: spacing[2] },
  disconnectBtn: { marginTop: spacing[3] },
}));

export const DeviceCard: React.FC<DeviceCardProps> = ({
  bleState,
  scanning,
  connecting,
  connectedDevice,
  waitingForMeasurement,
  onScan,
  onDisconnect,
}) => {
  const { colors } = useTheme();
  const styles = useStyles();
  const isOff = bleState !== State.PoweredOn;

  return (
    <Card style={styles.card}>
      <AppText variant="headline" style={styles.title}>Bluetooth Device</AppText>

      {!connectedDevice ? (
        <>
          <AppView center style={styles.illustration}>
            <AppView style={[styles.iconWrap, { backgroundColor: colors.secondary }]} center>
              <AppText style={styles.icon}>📡</AppText>
            </AppView>
            <AppText variant="footnote" secondary align="center" style={styles.hint}>
              Connect a BLE blood pressure monitor that supports{'\n'}
              the Bluetooth Blood Pressure Profile (BLP).
            </AppText>
          </AppView>
          <Button
            label={isOff ? 'Bluetooth is Off' : 'Scan for Devices'}
            onPress={onScan}
            variant="primary"
            size="lg"
            fullWidth
            loading={scanning}
            disabled={connecting || isOff}
          />
        </>
      ) : (
        <AppView center style={styles.connectedBox}>
          <AppView row align="center" gap={2} style={styles.connectedHeader}>
            <AppView style={[styles.dot, { backgroundColor: '#22c55e' }]} />
            <AppText variant="subhead" weight="semiBold">
              {connectedDevice.name ?? 'BLE Device'}
            </AppText>
          </AppView>

          {waitingForMeasurement ? (
            <AppView center style={styles.waitBox}>
              <AppView>
                <PulseRing color="#ef4444" active />
                <AppText style={styles.heartIcon}>❤️</AppText>
              </AppView>
              <AppText variant="headline" style={styles.waitText}>
                Waiting for measurement…
              </AppText>
              <AppText variant="footnote" secondary>
                Press the start button on your device.
              </AppText>
            </AppView>
          ) : (
            <AppText variant="subhead" color="#22c55e" style={styles.readyText}>
              ✓ Reading received
            </AppText>
          )}

          <Button
            label="Disconnect"
            onPress={onDisconnect}
            variant="outline"
            size="md"
            fullWidth
            style={styles.disconnectBtn}
          />
        </AppView>
      )}
    </Card>
  );
};
