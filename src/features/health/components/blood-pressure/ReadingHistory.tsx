import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { AppView } from '../../../../components';
import { BPReading } from '../../types/bloodpressure.types';
import { CATEGORY_META } from '../../constants/bpClassifier.constant';

interface ReadingHistoryProps {
  readings: BPReading[];
  limit?: number;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
  ' · ' +
  date.toLocaleDateString([], { month: 'short', day: 'numeric' });

export const ReadingHistory: React.FC<ReadingHistoryProps> = ({
  readings,
  limit = 10,
}) => {
  if (!readings.length) return null;

  return (
    <AppView style={styles.card}>
      <Text style={styles.title}>Recent History</Text>
      {readings.slice(0, limit).map(r => {
        const meta = CATEGORY_META[r.category];
        return (
          <AppView key={r.id} style={styles.row}>
            <AppView style={[styles.bar, { backgroundColor: meta.color }]} />
            <AppView style={styles.main}>
              <Text style={styles.bp}>
                {r.systolic}/{r.diastolic} mmHg
              </Text>
              {r.pulse ? <Text style={styles.pulse}>♥ {r.pulse}</Text> : null}
            </AppView>
            <AppView style={styles.right}>
              <Text style={[styles.category, { color: meta.color }]}>
                {meta.label}
              </Text>
              <Text style={styles.time}>{formatTime(r.timestamp)}</Text>
              <Text style={styles.source}>
                {r.source === 'device' ? '📡' : '✏️'}
              </Text>
            </AppView>
          </AppView>
        );
      })}
    </AppView>
  );
};

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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  bar: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  main: { flex: 1 },
  bp: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  pulse: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  category: { fontSize: 12, fontWeight: '600' },
  time: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  source: { fontSize: 14, marginTop: 2 },
});
