import React from 'react';
import { AppText, AppView, Loader } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { HistoryEntry } from '../../types/hydration.type';
import { makeStyles } from '../../../../hooks/makeStyles';

interface HistoryListProps {
  history: HistoryEntry[];
  isLoading: boolean;
}

const formatTime = (date: Date): string =>
  new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

const getBadge = (amount: number, colors: any) => {
  if (amount >= 500) return { label: '🍶 Large', bg: withOpacity(colors.primary, 0.2) };
  if (amount >= 200) return { label: '🥤 Medium', bg: withOpacity(colors.primary, 0.1) };
  return { label: '🥛 Small', bg: withOpacity(colors.primary, 0.08) };
};

const getSourceIcon = (source: HistoryEntry['source']) => {
  if (source === 'healthkit') return ' 🍎';
  if (source === 'health_connect') return ' 🤖';
  return '';
};

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  container: {
    marginBottom: spacing[2.5],
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[3],
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1.5],
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  count: {
    fontSize: fontSize.sm,
  },
  empty: {
    alignItems: 'center' as const,
    paddingVertical: spacing[10],
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: spacing[2.5],
  },
  emptyText: {
    fontSize: fontSize.md,
  },
  item: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.lg,
    marginBottom: spacing[2],
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    marginRight: spacing[3],
  },
  info: {
    flex: 1,
  },
  amount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
  },
  sourceIcon: {
    fontSize: fontSize.sm,
  },
  time: {
    fontSize: fontSize.sm,
    marginTop: spacing[0.5],
  },
  badge: {
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1],
    borderRadius: radius['2xl'],
  },
  badgeText: {
    fontSize: 11,
    fontWeight: fontWeight.semiBold,
  },
}));

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  isLoading,
}) => {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <AppView style={styles.container}>
      <AppView style={styles.header}>
        <AppText style={[styles.sectionTitle, { color: colors.mutedForeground }]}>History</AppText>
        <AppView style={styles.headerRight}>
          {isLoading && <Loader size="small" />}
          <AppText style={[styles.count, { color: colors.secondaryForeground }]}>{history.length} entries</AppText>
        </AppView>
      </AppView>

      {history.length === 0 && !isLoading ? (
        <AppView style={styles.empty}>
          <AppText style={styles.emptyIcon}>💧</AppText>
          <AppText style={[styles.emptyText, { color: colors.secondaryForeground }]}>No entries yet. Start drinking!</AppText>
        </AppView>
      ) : (
        history.map((entry, index) => {
          const badge = getBadge(entry.amount, colors);
          return (
            <AppView
              key={entry.id}
              style={[
                styles.item,
                { backgroundColor: withOpacity(colors.primary, 0.08), borderColor: withOpacity(colors.primary, 0.1) },
                index === 0 && { backgroundColor: withOpacity(colors.primary, 0.15), borderColor: withOpacity(colors.primary, 0.2) }
              ]}
            >
              <AppView style={[styles.dot, { backgroundColor: colors.primary }]} />
              <AppView style={styles.info}>
                <AppText style={[styles.amount, { color: colors.primary }]}>
                  +{entry.amount} ml
                  <AppText style={styles.sourceIcon}>
                    {getSourceIcon(entry.source)}
                  </AppText>
                </AppText>
                <AppText style={[styles.time, { color: colors.secondaryForeground }]}>{formatTime(entry.time)}</AppText>
              </AppView>
              <AppView style={[styles.badge, { backgroundColor: badge.bg }]}>
                <AppText style={[styles.badgeText, { color: colors.primary }]}>{badge.label}</AppText>
              </AppView>
            </AppView>
          );
        })
      )}
    </AppView>
  );
};
