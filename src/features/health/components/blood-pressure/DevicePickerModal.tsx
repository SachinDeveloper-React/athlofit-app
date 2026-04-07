import React from 'react';
import { FlatList, Modal, StyleSheet } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { AppText, AppView, Button, Loader } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

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
}) => {
  const { colors } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <AppView style={styles.overlay}>
        <AppView style={[styles.sheet, { backgroundColor: colors.card }]}>
          <AppView style={[styles.handle, { backgroundColor: colors.border }]} />
          <AppText variant="title3" style={styles.title}>Nearby Devices</AppText>

          {scanning && (
            <AppView row align="center" gap={2} style={styles.scanRow}>
              <Loader size="small" />
              <AppText variant="footnote" secondary>Scanning…</AppText>
            </AppView>
          )}

          {!devices.length && !scanning && (
            <AppText variant="footnote" secondary align="center" style={styles.empty}>
              No blood pressure devices found nearby.
            </AppText>
          )}

          <FlatList
            data={devices}
            keyExtractor={d => d.id}
            renderItem={({ item }) => (
              <Button
                variant="ghost"
                label={`${item.name}\n${item.id}`}
                onPress={() => onSelect(item)}
                fullWidth
                style={styles.item}
              />
            )}
          />

          <Button
            label="Cancel"
            onPress={onClose}
            variant="outline"
            size="md"
            fullWidth
            style={styles.cancelBtn}
          />
        </AppView>
      </AppView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: { marginBottom: 16 },
  scanRow: { marginBottom: 12 },
  empty: { paddingVertical: 32 },
  item: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  cancelBtn: { marginTop: 12 },
});
