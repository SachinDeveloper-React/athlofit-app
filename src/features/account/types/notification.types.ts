export type NotificationType = 'GOAL' | 'HYDRATION' | 'PRODUCT' | 'SECURITY' | 'HEART' | 'CHALLENGE' | 'COIN';

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number;
  read: boolean;
  data?: Record<string, string>;
};