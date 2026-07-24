import React from 'react';
import { StyleSheet } from 'react-native';
import { Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { Icon } from '../../../../components/Icon';

interface SaveButtonProps {
  onPress: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function SaveButton({ onPress, label = 'Save goal', loading, disabled }: SaveButtonProps) {
  const { colors } = useTheme();
  return (
    <Button
      label={label}
      onPress={onPress}
      variant="primary"
      size="lg"
      fullWidth
      loading={loading}
      disabled={disabled}
      rightIcon={<Icon name="Check" size={16} color={colors.primaryForeground} />}
    />
  );
}
