import { AppText, AppView } from '../../../../components';
import { memo } from 'react';
import { makeStyles } from '../../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  instrCard: {
    width: '100%' as const,
    borderRadius: radius.xl,
    padding: spacing[5],
    borderWidth: 0.5,
    borderColor: colors.border,
    marginVertical: spacing[5],
  },
  instrEmoji: { fontSize: 32, marginBottom: spacing[2.5] },
  instrTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    marginBottom: spacing[3.5 as any] ?? 14,
  },
  instrStep: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: spacing[2.5],
    gap: spacing[2.5],
  },
  instrBullet: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    backgroundColor: colors.foreground,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  instrNum: { color: colors.background, fontSize: 11, fontWeight: fontWeight.semiBold },
  instrTxt: { flex: 1, fontSize: fontSize.sm, color: colors.mutedForeground, lineHeight: 18 },
}));

export const InstructionCard = memo(() => {
  const styles = useStyles();
  return (
    <AppView style={styles.instrCard}>
      <AppText style={styles.instrEmoji}>👆</AppText>
      <AppText style={styles.instrTitle}>How to measure</AppText>
      {[
        'Cover the rear camera AND flash with your fingertip',
        'Apply gentle, steady pressure — not too hard',
        'Keep completely still for 30 seconds',
        "The screen will turn red — that's normal",
      ].map((step, i) => (
        <AppView key={i} style={styles.instrStep}>
          <AppView style={styles.instrBullet}>
            <AppText style={styles.instrNum}>{i + 1}</AppText>
          </AppView>
          <AppText style={styles.instrTxt}>{step}</AppText>
        </AppView>
      ))}
    </AppView>
  );
});
