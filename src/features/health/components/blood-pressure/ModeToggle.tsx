import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { AppView } from '../../../../components';
import { InputMode } from '../../types/bloodpressure.types';

interface ModeToggleProps {
  value: InputMode;
  onChange: (mode: InputMode) => void;
}

const MODES: { key: InputMode; label: string }[] = [
  { key: 'manual', label: '✏️  Manual Entry' },
  { key: 'device', label: '📡  Connected Device' },
];

export const ModeToggle: React.FC<ModeToggleProps> = ({ value, onChange }) => (
  <AppView style={styles.row}>
    {MODES.map(({ key, label }) => (
      <TouchableOpacity
        key={key}
        style={[styles.btn, value === key && styles.btnActive]}
        onPress={() => onChange(key)}
      >
        <Text style={[styles.text, value === key && styles.textActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    ))}
  </AppView>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  btnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  text: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  textActive: { color: '#f8fafc' },
});
