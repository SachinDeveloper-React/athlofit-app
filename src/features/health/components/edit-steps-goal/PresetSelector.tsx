import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Button } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { Preset } from '../../hooks/useStepsGoal';

interface PresetSelectorProps {
  presets: Preset[];
  activePreset: number | null;
  onSelect: (val: number) => void;
}

export function PresetSelector({ presets, activePreset, onSelect }: PresetSelectorProps) {
  return (
    <AppView>
      <AppText variant="overline" style={styles.sectionLabel}>Quick select</AppText>
      <AppView row gap={2} style={styles.row}>
        {presets.map((p) => {
          const isActive = activePreset === p.value;
          return (
            <AppView key={p.value} style={styles.btnWrap}>
              <Button
                label={p.label}
                onPress={() => onSelect(p.value)}
                variant={isActive ? 'tinted' : 'outline'}
                size="sm"
                fullWidth
              />
              <AppText
                variant="caption2"
                secondary={!isActive}
                style={isActive ? styles.tagActive : styles.tag}
              >
                {p.tag}
              </AppText>
            </AppView>
          );
        })}
      </AppView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginBottom: 10,
  },
  row: {
    marginBottom: 24,
  },
  btnWrap: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tag: {
    fontSize: 11,
    marginTop: 2,
  },
  tagActive: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
});
