import { Fragment, memo } from 'react';
import { AppText, AppView } from '../../../../components';
import {
  getConfidenceLabel,
  getHeartRateZone,
  HeartRateResult,
} from '../../service/heartRate.service';
import { makeStyles } from '../../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  resultCard: {
    width: '100%' as const,
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing[7],
    alignItems: 'center' as const,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: spacing[4],
  },
  resultBpm: {
    fontSize: 84,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
    lineHeight: 92,
  },
  resultUnit: { fontSize: fontSize.xl, color: colors.mutedForeground, marginTop: spacing[0.5] },
  zoneBadge: {
    paddingHorizontal: spacing[3.5 as any] ?? 14,
    paddingVertical: spacing[1.25 as any] ?? 5,
    borderRadius: radius.md,
    marginTop: spacing[3],
    marginBottom: spacing[1.5],
  },
  zoneTxt: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  confTxt: { fontSize: fontSize.sm, marginBottom: spacing[5] },
  statsRow: {
    flexDirection: 'row' as const,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingTop: spacing[4],
    width: '100%' as const,
  },
  stat: { flex: 1, alignItems: 'center' as const },
  statVal: { fontSize: fontSize.base, fontWeight: fontWeight.semiBold, color: colors.foreground },
  statLbl: { fontSize: fontSize.xs, color: colors.mutedForeground, marginTop: spacing[0.5] },
  statDiv: { width: 0.5, backgroundColor: colors.border },
}));

export const HeartRateResultCard = memo(
  ({ result }: { result: HeartRateResult }) => {
    const styles = useStyles();
    const zone = getHeartRateZone(result.bpm);
    const conf = getConfidenceLabel(result.confidence);
    return (
      <AppView style={styles.resultCard}>
        <AppText style={styles.resultBpm}>{result.bpm}</AppText>
        <AppText style={styles.resultUnit}>bpm</AppText>
        <AppView style={[styles.zoneBadge, { backgroundColor: zone.bg }]}>
          <AppText style={[styles.zoneTxt, { color: zone.color }]}>
            {zone.label}
          </AppText>
        </AppView>
        <AppText style={[styles.confTxt, { color: conf.color }]}>
          {conf.text}
        </AppText>
        <AppView style={styles.statsRow}>
          {[
            { label: 'peaks', value: String(result.peaksDetected) },
            { label: 'frames', value: String(result.samplesUsed) },
            { label: 'seconds', value: String(result.durationS) },
          ].map((stat, i, arr) => (
            <Fragment key={stat.label}>
              <AppView style={styles.stat}>
                <AppText style={styles.statVal}>{stat.value}</AppText>
                <AppText style={styles.statLbl}>{stat.label}</AppText>
              </AppView>
              {i < arr.length - 1 && <AppView style={styles.statDiv} />}
            </Fragment>
          ))}
        </AppView>
      </AppView>
    );
  },
);
