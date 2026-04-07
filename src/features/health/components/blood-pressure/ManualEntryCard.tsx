import React, { useState } from 'react';
import { TextInput, Alert, StyleSheet } from 'react-native';
import { AppText, AppView, Button, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

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
  const { colors } = useTheme();

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

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.border,
      backgroundColor: colors.secondary,
      color: colors.foreground,
    },
  ];

  return (
    <Card style={styles.card}>
      <AppText variant="headline" style={styles.title}>Enter Reading</AppText>

      {/* Systolic / Diastolic row */}
      <AppView row align="center" gap={2} style={styles.inputRow}>
        <AppView style={styles.group}>
          <AppText variant="overline" style={styles.label}>Systolic</AppText>
          <TextInput
            style={inputStyle}
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="number-pad"
            placeholder="120"
            placeholderTextColor={colors.mutedForeground}
            maxLength={3}
          />
          <AppText variant="caption2" secondary align="center" style={styles.unitLabel}>mmHg</AppText>
        </AppView>
        <AppText variant="title2" secondary style={styles.divider}>/</AppText>
        <AppView style={styles.group}>
          <AppText variant="overline" style={styles.label}>Diastolic</AppText>
          <TextInput
            style={inputStyle}
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="number-pad"
            placeholder="80"
            placeholderTextColor={colors.mutedForeground}
            maxLength={3}
          />
          <AppText variant="caption2" secondary align="center" style={styles.unitLabel}>mmHg</AppText>
        </AppView>
      </AppView>

      {/* Pulse row */}
      <AppView row align="center" gap={2} style={styles.pulseRow}>
        <AppText variant="overline" style={styles.label}>Pulse (optional)</AppText>
        <TextInput
          style={[inputStyle, styles.pulseInput]}
          value={pulse}
          onChangeText={setPulse}
          keyboardType="number-pad"
          placeholder="72"
          placeholderTextColor={colors.mutedForeground}
          maxLength={3}
        />
        <AppText variant="caption2" secondary>bpm</AppText>
      </AppView>

      <Button
        label="Save Reading"
        onPress={handleSubmit}
        variant="primary"
        size="lg"
        fullWidth
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  title: { marginBottom: 16 },
  inputRow: { marginBottom: 16 },
  group: { flex: 1 },
  label: { marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  unitLabel: { marginTop: 4 },
  divider: { marginTop: 16 },
  pulseRow: { marginBottom: 20 },
  pulseInput: { flex: 1, fontSize: 18, paddingVertical: 10 },
});
