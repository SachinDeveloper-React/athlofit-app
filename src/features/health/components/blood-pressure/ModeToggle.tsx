import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Button, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { InputMode } from '../../types/bloodpressure.types';

interface ModeToggleProps {
  value: InputMode;
  onChange: (mode: InputMode) => void;
}

const MODES: { key: InputMode; label: string }[] = [
  { key: 'manual', label: '✏️  Manual Entry' },
  { key: 'device', label: '📡  Connected Device' },
];

export const ModeToggle: React.FC<ModeToggleProps> = ({ value, onChange }) => {
  const { colors } = useTheme();
  return (
    <AppView row gap={2} style={styles.row}>
      {MODES.map(({ key, label }) => (
        <Button
          key={key}
          label={label}
          onPress={() => onChange(key)}
          variant={value === key ? 'primary' : 'outline'}
          size="sm"
          style={styles.btn}
        />
      ))}
    </AppView>
  );
};

const styles = StyleSheet.create({
  row: {
    marginBottom: 16,
  },
  btn: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
