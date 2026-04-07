import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { BPCategory } from '../../types/bloodpressure.types';
import { CATEGORY_META } from '../../constants/bpClassifier.constant';

const RANGES: Record<BPCategory, string> = {
  low: '< 90/60',
  normal: '< 120/80',
  elevated: '120–129/< 80',
  high1: '130–139/80–89',
  high2: '140–179/90–119',
  crisis: '≥ 180/≥ 120',
};

export const BPCategoryChart: React.FC = () => {
  const { colors } = useTheme();
  return (
    <Card style={styles.card}>
      <AppText variant="headline" style={styles.title}>BP Categories</AppText>
      {(
        Object.entries(CATEGORY_META) as [
          BPCategory,
          (typeof CATEGORY_META)[BPCategory],
        ][]
      ).map(([key, meta]) => (
        <AppView key={key} row align="center" style={styles.row}>
          <AppView style={[styles.dot, { backgroundColor: meta.color }]} />
          <AppText variant="subhead" style={styles.label}>{meta.label}</AppText>
          <AppText
            variant="caption1"
            secondary
            style={styles.range}
          >
            {RANGES[key]}
          </AppText>
        </AppView>
      ))}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 16,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  label: { flex: 1 },
  range: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
