import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
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
  const { colors } = useTheme();
  const meta = CATEGORY_META[reading.category];

  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: meta.bg, borderColor: meta.color + '40' },
      ]}
      variant="outlined"
    >
      <AppView row spaceBetween align="flex-start" style={styles.top}>
        <AppView>
          <AppText variant="label" color={meta.color} style={styles.label}>
            {meta.icon} {meta.label}
          </AppText>
          <AppView row align="flex-end" gap={1} style={styles.bpRow}>
            <AppText variant="title1">{reading.systolic}</AppText>
            <AppText variant="title2" secondary>/</AppText>
            <AppText variant="title1">{reading.diastolic}</AppText>
            <AppText variant="footnote" secondary style={styles.unit}>mmHg</AppText>
          </AppView>
          {reading.pulse ? (
            <AppText variant="subhead" secondary style={styles.pulse}>
              ♥ {reading.pulse} bpm
            </AppText>
          ) : null}
        </AppView>
        <AppView align="flex-end">
          <AppText variant="footnote" secondary>
            {reading.source === 'device'
              ? '📡 ' + (reading.deviceName ?? 'Device')
              : '✏️ Manual'}
          </AppText>
          <AppText variant="caption2" secondary style={styles.time}>
            {formatTime(reading.timestamp)}
          </AppText>
        </AppView>
      </AppView>
      <AppText variant="footnote" color={meta.color} weight="medium" style={styles.advice}>
        {meta.advice}
      </AppText>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { marginBottom: 16 },
  top: { marginBottom: 8 },
  label: { marginBottom: 8 },
  bpRow: { marginBottom: 4 },
  unit: { marginBottom: 10, marginLeft: 4 },
  pulse: { marginTop: 4 },
  time: { marginTop: 4 },
  advice: { marginTop: 12 },
});
