import { memo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
} from 'react-native';
import { AppText, AppView, Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

export const ManualEntryModal = memo(
  ({
    visible,
    onClose,
    onSave,
  }: {
    visible: boolean;
    onClose: () => void;
    onSave: (bpm: number) => Promise<void>;
  }) => {
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const { colors } = useTheme();

    const handleSave = async () => {
      const bpm = parseInt(value, 10);
      if (isNaN(bpm) || bpm < 30 || bpm > 250) {
        Alert.alert('Invalid BPM', 'Enter a value between 30 and 250.');
        return;
      }
      setSaving(true);
      try {
        await onSave(bpm);
        setValue('');
        onClose();
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to save');
      } finally {
        setSaving(false);
      }
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <AppView style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <AppText variant="headline" style={styles.modalTitle}>Enter Heart Rate</AppText>
            <AppText variant="footnote" secondary style={styles.modalSub}>
              Count your pulse for 60 s or read from a device.
            </AppText>
            <AppView
              row
              align="center"
              style={[styles.bpmRow, { borderColor: colors.border }]}
            >
              <TextInput
                style={[styles.bpmInput, { color: colors.foreground }]}
                value={value}
                onChangeText={setValue}
                placeholder="72"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={3}
                autoFocus
              />
              <AppText variant="subhead" secondary>bpm</AppText>
            </AppView>
            <AppView row gap={2}>
              <Button
                label="Cancel"
                onPress={onClose}
                variant="outline"
                size="md"
                style={styles.flex1}
              />
              <Button
                label="Save"
                onPress={handleSave}
                variant="primary"
                size="md"
                loading={saving}
                disabled={saving}
                style={styles.flex1}
              />
            </AppView>
          </AppView>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    padding: 24,
  },
  modalTitle: { marginBottom: 6 },
  modalSub: { marginBottom: 20, lineHeight: 18 },
  bpmRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  bpmInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '500',
    paddingVertical: 10,
    textAlign: 'center',
  },
  flex1: { flex: 1 },
});
