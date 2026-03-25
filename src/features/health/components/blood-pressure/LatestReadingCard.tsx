import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { AppView } from '../../../../components';
import { BPReading } from '../../types/bloodpressure.types';
import { CATEGORY_META } from '../../constants/bpClassifier.constant';

interface LatestReadingCardProps {
  reading: BPReading;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
  ' · ' +
  date.toLocaleDateString([], { month: 'short', day: 'numeric' });

export const LatestReadingCard: React.FC<LatestReadingCardProps> = ({
  reading,
}) => {
  const meta = CATEGORY_META[reading.category];

  return (
    <AppView
      style={[
        styles.card,
        { backgroundColor: meta.bg, borderColor: meta.color + '40' },
      ]}
    >
      <AppView style={styles.top}>
        <AppView>
          <Text style={[styles.label, { color: meta.color }]}>
            {meta.icon} {meta.label}
          </Text>
          <AppView style={styles.bpRow}>
            <Text style={styles.bpBig}>{reading.systolic}</Text>
            <Text style={styles.slash}>/</Text>
            <Text style={styles.bpBig}>{reading.diastolic}</Text>
            <Text style={styles.unit}>mmHg</Text>
          </AppView>
          {reading.pulse ? (
            <Text style={styles.pulse}>♥ {reading.pulse} bpm</Text>
          ) : null}
        </AppView>
        <AppView style={styles.meta}>
          <Text style={styles.source}>
            {reading.source === 'device'
              ? '📡 ' + (reading.deviceName ?? 'Device')
              : '✏️ Manual'}
          </Text>
          <Text style={styles.time}>{formatTime(reading.timestamp)}</Text>
        </AppView>
      </AppView>
      <Text style={[styles.advice, { color: meta.color }]}>{meta.advice}</Text>
    </AppView>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1.5, padding: 20, marginBottom: 16 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  bpRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  bpBig: { fontSize: 28, fontWeight: '800', lineHeight: 52, color: '#0f172a' },
  slash: { fontSize: 26, color: '#94a3b8', marginBottom: 4 },
  unit: { fontSize: 14, color: '#64748b', marginBottom: 10, marginLeft: 4 },
  pulse: { fontSize: 15, color: '#64748b', marginTop: 4 },
  meta: { alignItems: 'flex-end' },
  source: { fontSize: 13, color: '#64748b' },
  time: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  advice: { fontSize: 13, fontWeight: '500', marginTop: 12 },
});
