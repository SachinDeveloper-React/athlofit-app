import React from 'react';
import { FlatList, Modal } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { AppText, AppView, Button, Loader } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { makeStyles } from '../../../../hooks/makeStyles';

interface DevicePickerModalProps {
  visible: boolean;
  scanning: boolean;
  devices: Device[];
  onSelect: (device: Device) => void;
  onClose: () => void;
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    borderTopLeftRadius: radius['3xl'],
    borderTopRightRadius: radius['3xl'],
    padding: spacing[6],
    maxHeight: '70%' as const,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: spacing[0.5],
    alignSelf: 'center' as const,
    marginBottom: spacing[5],
  },
  title: { marginBottom: spacing[4] },
  scanRow: { marginBottom: spacing[3] },
  empty: { paddingVertical: spacing[8] },
  item: { paddingVertical: spacing[3.5 as any] ?? 14, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  cancelBtn: { marginTop: spacing[3] },
}));

export const DevicePickerModal: React.FC<DevicePickerModalProps> = ({
  visible,
  scanning,
  devices,
  onSelect,
  onClose,
}) => {
  const { colors } = useTheme();
  const styles = useStyles();
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
              No devices found nearby. Make sure your device is in pairing mode and Bluetooth is enabled.
            </AppText>
          )}

          <FlatList
            data={devices}
            keyExtractor={d => d.id}
            renderItem={({ item }) => (
              <Button
                variant="ghost"
                label={`${item.name || item.localName || 'Unknown Device'}\n${item.id}`}
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
