import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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

const getBadge = (amount: number) => {
  if (amount >= 500) return { label: '🍶 Large', bg: 'rgba(56,189,248,0.2)' };
  if (amount >= 200) return { label: '🥤 Medium', bg: 'rgba(14,165,233,0.1)' };
  return { label: '🥛 Small', bg: 'rgba(14,165,233,0.08)' };
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
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>History</Text>
        <View style={styles.headerRight}>
          {isLoading && (
            <ActivityIndicator
              size="small"
              color="#38bdf8"
              style={styles.loader}
            />
          )}
          <Text style={styles.count}>{history.length} entries</Text>
        </View>
      </View>

      {history.length === 0 && !isLoading ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>💧</Text>
          <Text style={styles.emptyText}>No entries yet. Start drinking!</Text>
        </View>
      ) : (
        history.map((entry, index) => {
          const badge = getBadge(entry.amount);
          return (
            <View
              key={entry.id}
              style={[styles.item, index === 0 && styles.itemFirst]}
            >
              <View style={styles.dot} />
              <View style={styles.info}>
                <Text style={styles.amount}>
                  +{entry.amount} ml
                  <Text style={styles.sourceIcon}>
                    {getSourceIcon(entry.source)}
                  </Text>
                </Text>
                <Text style={styles.time}>{formatTime(entry.time)}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={styles.badgeText}>{badge.label}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>
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
  loader: {
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    color: '#475569',
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 12,
    color: '#334155',
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
    color: '#334155',
    fontSize: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(14,50,80,0.25)',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.08)',
  },
  itemFirst: {
    borderColor: 'rgba(56,189,248,0.25)',
    backgroundColor: 'rgba(14,165,233,0.08)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0ea5e9',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e0f2fe',
  },
  sourceIcon: {
    fontSize: 13,
  },
  time: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    color: '#7dd3fc',
    fontWeight: '600',
  },
});
