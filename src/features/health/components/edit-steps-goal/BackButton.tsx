import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';

interface BackButtonProps {
  onPress?: () => void;
}

export function BackButton({ onPress }: BackButtonProps) {
  const { colors } = useTheme();
  return (
    <Button
      variant="ghost"
      size="sm"
      label="Back"
      onPress={onPress ?? (() => {})}
      leftIcon={<AppText style={[styles.arrow, { color: colors.mutedForeground }]}>‹</AppText>}
      style={styles.row}
      labelStyle={{ color: colors.mutedForeground }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 28,
    alignSelf: 'flex-start',
  },
  arrow: {
    fontSize: 24,
    lineHeight: 26,
    marginTop: -2,
  },
});
