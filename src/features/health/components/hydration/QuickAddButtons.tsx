import React from 'react';
import { AppText, AppView, Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { DrinkSize } from '../../types/hydration.type';
import { makeStyles } from '../../../../hooks/makeStyles';

interface QuickAddButtonsProps {
  onAdd: (amount: DrinkSize) => void;
  onReset: () => void;
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  container: {
    marginBottom: spacing[5],
  },
  sectionTitle: {
    marginBottom: spacing[3],
  },
  btnRow: {
    marginBottom: spacing[3],
  },
  addBtn: {
    flex: 1,
    alignSelf: 'stretch' as const,
  },
}));

export const QuickAddButtons: React.FC<QuickAddButtonsProps> = ({
  onAdd,
  onReset,
}) => {
  const styles = useStyles();

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
