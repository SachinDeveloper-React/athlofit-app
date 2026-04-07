// src/features/account/screens/NotificationsScreen.tsx
import { SectionList, StyleSheet, ActivityIndicator, View } from 'react-native';
import React, { useCallback, useEffect, useMemo } from 'react';
import { AppText, AppView, Header, Screen } from '../../../components';
import { NotificationItem } from '../types/notification.types';
import { groupSections, SectionT } from '../service/notificationService';
import { useTheme } from '../../../hooks/useTheme';
import { useNotificationStyles } from '../styles/useNotificationStyles';
import { NotificationRow } from '../components/notification/NotificationRow';
import { useNotifications } from '../hooks/useNotifications';
import { Icon } from '../../../components/Icon';

const NotificationsScreen = () => {
  const { colors } = useTheme();
  const s = useMemo(() => useNotificationStyles(colors), [colors]);

  const { mutate: loadNotifications, data: items, isPending } = useNotifications();

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const keyExtractor = useCallback((it: NotificationItem) => it.id, []);

  const sections = useMemo(
    () => groupSections(items ?? []),
    [items],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow
        item={item}
        onPress={() => {}}
        style={{ marginBottom: 10 }}
      />
    ),
    [],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionT }) => (
      <AppView style={s.sectionHeader}>
        <AppText style={s.sectionTitle}>{section.title}</AppText>
      </AppView>
    ),
    [s.sectionHeader, s.sectionTitle],
  );

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <Screen
        scroll={false}
        safeArea={false}
        header={<Header title="Notifications" backLabel="" showBack />}
      >
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: 12 }}>
            Loading notifications...
          </AppText>
        </View>
      </Screen>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!isPending && sections.length === 0) {
    return (
      <Screen
        scroll={false}
        safeArea={false}
        header={<Header title="Notifications" backLabel="" showBack />}
      >
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIconWrap,
              { backgroundColor: colors.primary + '18' },
            ]}
          >
            <Icon name="BellOff" size={36} color={colors.primary} />
          </View>
          <AppText variant="title3" weight="semiBold" style={{ marginTop: 16 }}>
            No notifications yet
          </AppText>
          <AppText
            variant="body"
            secondary
            align="center"
            style={{ marginTop: 8, lineHeight: 22, paddingHorizontal: 32 }}
          >
            Activity alerts, order updates, and streak milestones will appear
            here as you use the app.
          </AppText>
        </View>
      </Screen>
    );
  }

  // ── List ───────────────────────────────────────────────────────────────────
  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Notifications" backLabel="" showBack />}
    >
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={10}
        windowSize={10}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={16}
        SectionSeparatorComponent={() => <AppView style={{ height: 6 }} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
