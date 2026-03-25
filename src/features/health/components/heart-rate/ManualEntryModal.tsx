import { memo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { AppText, AppView } from '../../../../components';

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
          style={s.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <AppView style={s.modalCard}>
            <AppText style={s.modalTitle}>Enter Heart Rate</AppText>
            <AppText style={s.modalSub}>
              Count your pulse for 60 s or read from a device.
            </AppText>
            <AppView style={s.bpmRow}>
              <TextInput
                style={s.bpmInput}
                value={value}
                onChangeText={setValue}
                placeholder="72"
                placeholderTextColor="#ccc"
                keyboardType="number-pad"
                maxLength={3}
                autoFocus
              />
              <AppText style={s.bpmUnit}>bpm</AppText>
            </AppView>
            <AppView style={s.row}>
              <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
                <AppText style={s.cancelTxt}>Cancel</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <AppText style={s.saveTxt}>Save</AppText>
                )}
              </TouchableOpacity>
            </AppView>
          </AppView>
        </KeyboardAvoidingView>
      </Modal>
    );
  },
);
const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  modalSub: { fontSize: 13, color: '#888', marginBottom: 20, lineHeight: 18 },
  bpmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  bpmInput: {
    flex: 1,
    fontSize: 40,
    fontWeight: '500',
    color: '#1a1a1a',
    paddingVertical: 10,
    textAlign: 'center',
  },
  bpmUnit: { fontSize: 16, color: '#aaa' },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    alignItems: 'center',
  },
  cancelTxt: { fontSize: 15, color: '#666' },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  saveTxt: { fontSize: 15, color: '#fff', fontWeight: '500' },
});
