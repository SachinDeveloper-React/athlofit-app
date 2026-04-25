// src/features/account/screens/NotificationsScreen.tsx
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { AppText, AppView, Header, Screen } from '../../../components';
import { Icon } from '../../../components/Icon';
import { useTheme } from '../../../hooks/useTheme';
import { useNotificationStyles } from '../styles/useNotificationStyles';
import { NotificationRow } from '../components/notification/NotificationRow';
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
} from '../hooks/useNotifications';
import { groupSections, SectionT } from '../service/notificationService';
import { handleNotificationNavigation } from '../../../services/pushNotificationService';
import type { NotificationItem } from '../types/notification.types';

const NotificationsScreen = () => {
  const { colors } = useTheme();
  const s = useMemo(() => useNotificationStyles(colors), [colors]);

  const { data, isLoading, isRefetching, refetch } = useNotifications();
  const { mutate: markRead }    = useMarkRead();
  const { mutate: markAll }     = useMarkAllRead();
  const { mutate: deleteNotif } = useDeleteNotification();

  const notifications = data?.notifications ?? [];
  const unreadCount   = data?.unreadCount   ?? 0;

  const sections = useMemo(() => groupSections(notifications), [notifications]);

  const keyExtractor = useCallback((it: NotificationItem) => it.id, []);

  const handlePress = useCallback(
    (item: NotificationItem) => {
      if (!item.read) markRead(item.id);
      if (item.data?.screen) {
        handleNotificationNavigation(item.data as Record<string, string>);
      }
    },
    [markRead],
  );

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow
        item={item}
        onPress={handlePress}
        onDelete={deleteNotif}
        style={{ marginBottom: 10 }}
      />
    ),
    [handlePress, deleteNotif],
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionT }) => (
      <AppView style={s.sectionHeader}>
        <AppText style={s.sectionTitle}>{section.title}</AppText>
      </AppView>
    ),
    [s.sectionHeader, s.sectionTitle],
  );

  const markAllBtn = unreadCount > 0 ? (
    <Pressable onPress={() => markAll()} style={styles.markAllBtn}>
      <AppText variant="caption1" style={{ color: colors.primary }}>
        Mark all read
      </AppText>
    </Pressable>
  ) : undefined;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
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

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (sections.length === 0) {
    return (
      <Screen
        scroll={false}
        safeArea={false}
        header={<Header title="Notifications" backLabel="" showBack />}
      >
        <View style={styles.center}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primary + '18' }]}>
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
            Activity alerts, order updates, and streak milestones will appear here.
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
      header={
        <Header
          title={unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications'}
          backLabel=""
          showBack
          rightAction={markAllBtn}
        />
      }
    >
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        removeClippedSubviews
        initialNumToRender={15}
        windowSize={10}
        SectionSeparatorComponent={() => <AppView style={{ height: 6 }} />}
        scrollEnabled={false}
      />
    </Screen>
  );
};

export default NotificationsScreen;

const styles = StyleSheet.create({
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  markAllBtn:    { paddingHorizontal: 12, paddingVertical: 6 },
});
