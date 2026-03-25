import React from 'react';
import { Text, Platform, StyleSheet } from 'react-native';
import { AppView } from '../../../../components';
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

export const BPCategoryChart: React.FC = () => (
  <AppView style={styles.card}>
    <Text style={styles.title}>BP Categories</Text>
    {(
      Object.entries(CATEGORY_META) as [
        BPCategory,
        (typeof CATEGORY_META)[BPCategory],
      ][]
    ).map(([key, meta]) => (
      <AppView key={key} style={styles.row}>
        <AppView style={[styles.dot, { backgroundColor: meta.color }]} />
        <Text style={styles.label}>{meta.label}</Text>
        <Text style={styles.range}>{RANGES[key]}</Text>
      </AppView>
    ))}
  </AppView>
);

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
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  label: { flex: 1, fontSize: 14, fontWeight: '500', color: '#334155' },
  range: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
