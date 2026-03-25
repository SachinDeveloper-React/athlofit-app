import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { State, Device } from 'react-native-ble-plx';
import { AppView } from '../../../../components';
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
  const isOff = bleState !== State.PoweredOn;

  return (
    <AppView style={styles.card}>
      <Text style={styles.title}>Bluetooth Device</Text>

      {!connectedDevice ? (
        <>
          <AppView style={styles.illustration}>
            <AppView style={styles.iconWrap}>
              <Text style={styles.icon}>📡</Text>
            </AppView>
            <Text style={styles.hint}>
              Connect a BLE blood pressure monitor that supports{'\n'}
              the Bluetooth Blood Pressure Profile (BLP).
            </Text>
          </AppView>
          <TouchableOpacity
            style={[styles.btn, (connecting || isOff) && styles.btnDisabled]}
            onPress={onScan}
            disabled={connecting || isOff}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>
                {isOff ? 'Bluetooth is Off' : 'Scan for Devices'}
              </Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <AppView style={styles.connectedBox}>
          <AppView style={styles.connectedHeader}>
            <AppView style={styles.dot} />
            <Text style={styles.deviceName}>
              {connectedDevice.name ?? 'BLE Device'}
            </Text>
          </AppView>

          {waitingForMeasurement ? (
            <AppView style={styles.waitBox}>
              <AppView>
                <PulseRing color="#ef4444" active />
                <Text style={styles.heartIcon}>❤️</Text>
              </AppView>
              <Text style={styles.waitText}>Waiting for measurement…</Text>
              <Text style={styles.waitSub}>
                Press the start button on your device.
              </Text>
            </AppView>
          ) : (
            <Text style={styles.readyText}>✓ Reading received</Text>
          )}

          <TouchableOpacity style={styles.outlineBtn} onPress={onDisconnect}>
            <Text style={styles.outlineBtnText}>Disconnect</Text>
          </TouchableOpacity>
        </AppView>
      )}
    </AppView>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  illustration: { alignItems: 'center', paddingVertical: 20 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 36 },
  hint: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  btn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  btnDisabled: { backgroundColor: '#94a3b8' },
  connectedBox: { alignItems: 'center' },
  connectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  deviceName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  waitBox: { alignItems: 'center', paddingVertical: 20 },
  heartIcon: { fontSize: 48, textAlign: 'center' },
  waitText: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginTop: 16 },
  waitSub: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
  readyText: { fontSize: 16, fontWeight: '600', color: '#22c55e', marginBottom: 8 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  outlineBtnText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
});
