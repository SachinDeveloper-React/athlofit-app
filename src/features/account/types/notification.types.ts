export type NotificationType = 'GOAL' | 'HYDRATION' | 'PRODUCT' | 'SECURITY' | 'HEART';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  read?: boolean;
};