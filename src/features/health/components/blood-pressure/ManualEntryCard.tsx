import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { AppView } from '../../../../components';

interface ManualEntryCardProps {
  onSubmit: (
    systolic: number,
    diastolic: number,
    pulse: number | undefined,
  ) => void;
}

export const ManualEntryCard: React.FC<ManualEntryCardProps> = ({ onSubmit }) => {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');

  const handleSubmit = () => {
    const sys = parseInt(systolic, 10);
    const dia = parseInt(diastolic, 10);
    const pls = pulse ? parseInt(pulse, 10) : undefined;

    if (isNaN(sys) || sys < 60 || sys > 300) {
      Alert.alert('Invalid', 'Systolic must be between 60–300 mmHg.');
      return;
    }
    if (isNaN(dia) || dia < 40 || dia > 200) {
      Alert.alert('Invalid', 'Diastolic must be between 40–200 mmHg.');
      return;
    }
    if (pls !== undefined && (isNaN(pls) || pls < 30 || pls > 250)) {
      Alert.alert('Invalid', 'Pulse must be between 30–250 bpm.');
      return;
    }

    onSubmit(sys, dia, pls);
    setSystolic('');
    setDiastolic('');
    setPulse('');
  };

  return (
    <AppView style={styles.card}>
      <Text style={styles.title}>Enter Reading</Text>

      <AppView style={styles.inputRow}>
        <AppView style={styles.group}>
          <Text style={styles.label}>Systolic</Text>
          <TextInput
            style={styles.input}
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="number-pad"
            placeholder="120"
            placeholderTextColor="#94a3b8"
            maxLength={3}
          />
          <Text style={styles.unit}>mmHg</Text>
        </AppView>
        <Text style={styles.divider}>/</Text>
        <AppView style={styles.group}>
          <Text style={styles.label}>Diastolic</Text>
          <TextInput
            style={styles.input}
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="number-pad"
            placeholder="80"
            placeholderTextColor="#94a3b8"
            maxLength={3}
          />
          <Text style={styles.unit}>mmHg</Text>
        </AppView>
      </AppView>

      <AppView style={styles.pulseRow}>
        <Text style={styles.label}>Pulse (optional)</Text>
        <TextInput
          style={[styles.input, styles.pulseInput]}
          value={pulse}
          onChangeText={setPulse}
          keyboardType="number-pad"
          placeholder="72"
          placeholderTextColor="#94a3b8"
          maxLength={3}
        />
        <Text style={styles.unit}>bpm</Text>
      </AppView>

      <TouchableOpacity style={styles.btn} onPress={handleSubmit}>
        <Text style={styles.btnText}>Save Reading</Text>
      </TouchableOpacity>
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
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  group: { flex: 1 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    backgroundColor: '#f8fafc',
  },
  unit: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  divider: { fontSize: 32, color: '#cbd5e1', marginTop: 16 },
  pulseRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  pulseInput: { flex: 1, fontSize: 18, paddingVertical: 10 },
  btn: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnText: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
});
