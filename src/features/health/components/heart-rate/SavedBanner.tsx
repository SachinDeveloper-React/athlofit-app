import { AppText, AppView } from '../../../../components';
import { memo } from 'react';
import { makeStyles } from '../../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  savedBanner: {
    backgroundColor: '#EAF3DE',
    borderRadius: radius.lg,
    paddingVertical: spacing[3.25 as any] ?? 13,
    width: '100%' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[2.5],
  },
  savedTxt: { color: '#3B6D11', fontWeight: fontWeight.medium, fontSize: fontSize.base },
}));

export const SavedBanner = memo(() => {
  const styles = useStyles();
  return (
    <AppView style={styles.savedBanner}>
      <AppText style={styles.savedTxt}>✓ Saved to Health Connect</AppText>
    </AppView>
  );
});
