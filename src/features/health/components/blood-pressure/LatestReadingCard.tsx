import React from 'react';
import { AppText, AppView, Card } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { BPReading } from '../../types/bloodpressure.types';
import { CATEGORY_META } from '../../constants/bpClassifier.constant';
import { makeStyles } from '../../../../hooks/makeStyles';

interface LatestReadingCardProps {
  reading: BPReading;
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
  ' · ' +
  date.toLocaleDateString([], { month: 'short', day: 'numeric' });

const useStyles = makeStyles(({ colors, spacing }) => ({
  card: { marginBottom: spacing[4] },
  top: { marginBottom: spacing[2] },
  label: { marginBottom: spacing[2] },
  bpRow: { marginBottom: spacing[1] },
  unit: { marginBottom: spacing[2.5], marginLeft: spacing[1] },
  pulse: { marginTop: spacing[1] },
  time: { marginTop: spacing[1] },
  advice: { marginTop: spacing[3] },
}));

export const LatestReadingCard: React.FC<LatestReadingCardProps> = ({
  reading,
}) => {
  const styles = useStyles();
  const { isDark, colors } = useTheme();
  const meta = CATEGORY_META[reading.category];

  // In dark mode use the card background with a tinted border instead of
  // the hardcoded light pastel backgrounds which look wrong on dark themes.
  const cardBg = isDark
    ? colors.card
    : meta.bg;
  const cardBorder = withOpacity(meta.color, isDark ? 0.4 : 0.25);

  return (
    <Card
      style={[
        styles.card,
        { backgroundColor: cardBg, borderColor: cardBorder },
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
