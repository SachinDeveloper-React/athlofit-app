import { AppText, AppView } from '../../../../components';
import { MEASURE_DURATION_S } from '../../service/heartRate.service';
import { memo } from 'react';
import { makeStyles } from '../../../../hooks/makeStyles';

const RING = 180;

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginVertical: spacing[5],
  },
  ringTrack: {
    position: 'absolute' as const,
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 7,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ringArc: {
    position: 'absolute' as const,
    width: RING - 14,
    height: RING - 14,
    borderRadius: (RING - 14) / 2,
    borderWidth: 7,
  },
  ringInner: { alignItems: 'center' as const },
  ringNum: { fontSize: 48, fontWeight: fontWeight.bold, color: '#fff' },
  ringSub: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)', marginTop: spacing[0.5] },
}));

export const ProgressRing = memo(({ progress }: { progress: number }) => {
  const styles = useStyles();
  const remaining = Math.max(
    0,
    Math.round(MEASURE_DURATION_S * (1 - progress)),
  );
  const p = Math.min(progress, 1);
  return (
    <AppView style={styles.ringWrap}>
      <AppView style={styles.ringTrack} />
      <AppView
        style={[
          styles.ringArc,
          {
            borderTopColor: '#D85A30',
            borderRightColor: p > 0.25 ? '#D85A30' : 'transparent',
            borderBottomColor: p > 0.5 ? '#D85A30' : 'transparent',
            borderLeftColor: p > 0.75 ? '#D85A30' : 'transparent',
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      />
      <AppView style={styles.ringInner}>
        <AppText style={styles.ringNum}>{remaining}</AppText>
        <AppText style={styles.ringSub}>seconds left</AppText>
      </AppView>
    </AppView>
  );
});
