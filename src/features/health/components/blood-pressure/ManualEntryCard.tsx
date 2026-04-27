import React, { useState } from 'react';
import { TextInput, Alert } from 'react-native';
import { AppText, AppView, Button, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { makeStyles } from '../../../../hooks/makeStyles';

interface ManualEntryCardProps {
  onSubmit: (
    systolic: number,
    diastolic: number,
    pulse: number | undefined,
  ) => void;
}

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  card: { marginBottom: spacing[4] },
  title: { marginBottom: spacing[4] },
  inputRow: { marginBottom: spacing[4] },
  group: { flex: 1 },
  label: { marginBottom: spacing[1.5] },
  input: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3.5 as any] ?? 14,
    paddingVertical: spacing[3],
    fontSize: 22,
    fontWeight: fontWeight.bold,
    textAlign: 'center' as const,
  },
  unitLabel: { marginTop: spacing[1] },
  divider: { marginTop: spacing[4] },
  pulseRow: { marginBottom: spacing[5] },
  pulseInput: { flex: 1, fontSize: fontSize.xl, paddingVertical: spacing[2.5] },
}));

export const ManualEntryCard: React.FC<ManualEntryCardProps> = ({ onSubmit }) => {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const { colors } = useTheme();
  const styles = useStyles();

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
