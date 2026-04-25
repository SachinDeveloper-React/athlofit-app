// src/features/account/hooks/useNotifications.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchNotifications,
  markRead,
  markAllRead,
  deleteNotification,
} from '../service/notificationService';

export const NOTIF_KEY = ['notifications'] as const;

export const useNotifications = () =>
  useQuery({
    queryKey: NOTIF_KEY,
    queryFn:  fetchNotifications,
    staleTime: 30_000,
    retry: 1,
  });

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
};

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTIF_KEY }),
  });
};
