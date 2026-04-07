import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
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
  const { colors } = useTheme();

  if (!readings.length) return null;

  return (
    <Card style={styles.card}>
      <AppText variant="headline" style={styles.title}>Recent History</AppText>
      {readings.slice(0, limit).map(r => {
        const meta = CATEGORY_META[r.category];
        return (
          <AppView key={r.id} row align="center" style={styles.row}>
            <AppView style={[styles.bar, { backgroundColor: meta.color }]} />
            <AppView style={styles.main}>
              <AppText variant="headline">
                {r.systolic}/{r.diastolic} mmHg
              </AppText>
              {r.pulse ? (
                <AppText variant="footnote" secondary>♥ {r.pulse}</AppText>
              ) : null}
            </AppView>
            <AppView align="flex-end">
              <AppText variant="caption1" color={meta.color}>{meta.label}</AppText>
              <AppText variant="caption2" secondary style={styles.time}>
                {formatTime(r.timestamp)}
              </AppText>
              <AppText variant="caption1" style={styles.source}>
                {r.source === 'device' ? '📡' : '✏️'}
              </AppText>
            </AppView>
          </AppView>
        );
      })}
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
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  bar: { width: 4, height: 40, borderRadius: 2, marginRight: 12 },
  main: { flex: 1 },
  time: { marginTop: 2 },
  source: { fontSize: 14, marginTop: 2 },
});
