// src/features/account/hooks/useNotifications.ts
import { useMutation } from '@tanstack/react-query';
import { fetchNotifications } from '../service/notificationService';
import { NotificationItem } from '../types/notification.types';

/**
 * useNotifications — fetches in-app notifications via useMutation.
 * Call `mutate()` to load; data is available in `data` after success.
 */
export const useNotifications = () => {
  return useMutation<NotificationItem[], Error, void>({
    mutationFn: () => fetchNotifications(),
  });
};
