import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { DrinkSize } from '../../types/hydration.type';

interface QuickAddButtonsProps {
  onAdd: (amount: DrinkSize) => void;
  onReset: () => void;
}

export const QuickAddButtons: React.FC<QuickAddButtonsProps> = ({
  onAdd,
  onReset,
}) => {
  const { colors } = useTheme();

  const DRINK_OPTIONS = [
    { ml: 100 as DrinkSize, emoji: '🥛' },
    { ml: 200 as DrinkSize, emoji: '🥤' },
    { ml: 500 as DrinkSize, emoji: '🍶' },
  ];

  return (
    <AppView style={styles.container}>
      <AppText variant="overline" secondary style={styles.sectionTitle}>
        Quick Add
      </AppText>

      <AppView row gap={2} style={styles.btnRow}>
        {DRINK_OPTIONS.map(btn => (
          <Button
            key={btn.ml}
            label={`${btn.emoji} +${btn.ml}ml`}
            onPress={() => onAdd(btn.ml)}
            variant="tinted"
            size="md"
            style={styles.addBtn}
          />
        ))}
      </AppView>

      <Button
        label="↺ Reset Day"
        onPress={onReset}
        variant="destructive"
        size="md"
        fullWidth
      />
    </AppView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  btnRow: {
    marginBottom: 12,
  },
  addBtn: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
