import React from 'react';
import {
  Modal,
  FlatList,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import { AppView } from '../../../../components';

interface DevicePickerModalProps {
  visible: boolean;
  scanning: boolean;
  devices: Device[];
  onSelect: (device: Device) => void;
  onClose: () => void;
}

export const DevicePickerModal: React.FC<DevicePickerModalProps> = ({
  visible,
  scanning,
  devices,
  onSelect,
  onClose,
}) => (
  <Modal
    visible={visible}
    transparent
    animationType="slide"
    onRequestClose={onClose}
  >
    <AppView style={styles.overlay}>
      <AppView style={styles.sheet}>
        <AppView style={styles.handle} />
        <Text style={styles.title}>Nearby Devices</Text>

        {scanning && (
          <AppView style={styles.scanRow}>
            <ActivityIndicator color="#3b82f6" size="small" />
            <Text style={styles.scanText}>Scanning…</Text>
          </AppView>
        )}

        {!devices.length && !scanning && (
          <Text style={styles.empty}>No blood pressure devices found nearby.</Text>
        )}

        <FlatList
          data={devices}
          keyExtractor={d => d.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.item} onPress={() => onSelect(item)}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemId}>{item.id}</Text>
            </TouchableOpacity>
          )}
        />

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </AppView>
    </AppView>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  scanText: { fontSize: 14, color: '#64748b' },
  empty: { fontSize: 14, color: '#94a3b8', textAlign: 'center', paddingVertical: 32 },
  item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  itemId: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  cancelBtn: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  cancelText: { color: '#0f172a', fontSize: 15, fontWeight: '600' },
});
