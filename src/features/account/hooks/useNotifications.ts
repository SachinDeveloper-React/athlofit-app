// src/features/account/hooks/useNotifications.ts
import { useMutation, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from '../service/notificationService';
import type { NotificationItem } from '../types/notification.types';

export const NOTIF_KEY = ['notifications'] as const;

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: NOTIF_KEY,
    queryFn: ({ pageParam = 1 }) => fetchNotifications(pageParam as number, 30),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination?.hasMore) return undefined;
      return lastPage.pagination.page + 1;
    },
    staleTime: 30_000,
    retry: 1,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      notifications: data.pages.flatMap(p => p.notifications),
      unreadCount: data.pages[0]?.unreadCount ?? 0,
    }),
  });

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markRead(id),
    // Optimistic update: mark as read immediately in cache
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: NOTIF_KEY });
      const prev = qc.getQueryData(NOTIF_KEY);
      
      qc.setQueryData(NOTIF_KEY, (old: any) => {
        if (!old?.notifications) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: NotificationItem) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, (old.unreadCount ?? 0) - 1),
        };
      });
      
      return { prev };
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.prev) {
        qc.setQueryData(NOTIF_KEY, context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
    },
  });
};

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    // Optimistic update: mark all as read immediately
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIF_KEY });
      const prev = qc.getQueryData(NOTIF_KEY);
      
      qc.setQueryData(NOTIF_KEY, (old: any) => {
        if (!old?.notifications) return old;
        return {
          ...old,
          notifications: old.notifications.map((n: NotificationItem) => ({ ...n, read: true })),
          unreadCount: 0,
        };
      });
      
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        qc.setQueryData(NOTIF_KEY, context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
    },
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    // Optimistic update: remove from list immediately
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: NOTIF_KEY });
      const prev = qc.getQueryData(NOTIF_KEY);
      
      qc.setQueryData(NOTIF_KEY, (old: any) => {
        if (!old?.notifications) return old;
        const deletedNotif = old.notifications.find((n: NotificationItem) => n.id === id);
        const wasUnread = deletedNotif && !deletedNotif.read;
        
        return {
          ...old,
          notifications: old.notifications.filter((n: NotificationItem) => n.id !== id),
          unreadCount: wasUnread ? Math.max(0, (old.unreadCount ?? 0) - 1) : old.unreadCount,
        };
      });
      
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        qc.setQueryData(NOTIF_KEY, context.prev);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: NOTIF_KEY });
    },
  });
};
