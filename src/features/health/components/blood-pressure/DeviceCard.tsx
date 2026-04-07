import React from 'react';
import { StyleSheet } from 'react-native';
import { State, Device } from 'react-native-ble-plx';
import { AppText, AppView, Button, Card, Loader } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { PulseRing } from './PulseRing';

interface DeviceCardProps {
  bleState: State;
  scanning: boolean;
  connecting: boolean;
  connectedDevice: Device | null;
  waitingForMeasurement: boolean;
  onScan: () => void;
  onDisconnect: () => void;
}

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

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  title: { marginBottom: 16 },
  illustration: { paddingVertical: 20 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  icon: { fontSize: 36 },
  hint: { lineHeight: 20 },
  connectedBox: { width: '100%' },
  connectedHeader: { marginBottom: 20 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  waitBox: { paddingVertical: 20, gap: 8 },
  heartIcon: { fontSize: 48, textAlign: 'center' },
  waitText: { marginTop: 16 },
  readyText: { marginBottom: 8 },
  disconnectBtn: { marginTop: 12 },
});
