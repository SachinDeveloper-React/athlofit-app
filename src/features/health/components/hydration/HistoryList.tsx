import React from 'react';
import { StyleSheet } from 'react-native';
import { AppText, AppView, Loader } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { HistoryEntry } from '../../types/hydration.type';

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

export const HistoryList: React.FC<HistoryListProps> = ({
  history,
  isLoading,
}) => {
  const { colors } = useTheme();

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

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  sourceIcon: {
    fontSize: 13,
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
