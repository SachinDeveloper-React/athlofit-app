import { Bell, Coins, Heart, ShieldCheck, ShoppingBag, Trophy, Zap } from 'lucide-react-native';
import { api } from '../../../utils/api';
import { NotificationItem, NotificationType } from '../types/notification.types';

// ─── API ──────────────────────────────────────────────────────────────────────

export const fetchNotifications = async (): Promise<{
  notifications: NotificationItem[];
  unreadCount: number;
}> => {
  const res = await api.get<{ notifications: NotificationItem[]; unreadCount: number }>(
    'user/notifications',
  );
  return { notifications: res.data?.notifications ?? [], unreadCount: res.data?.unreadCount ?? 0 };
};

export const markRead = async (id: string): Promise<void> => {
  await api.patch(`user/notifications/${id}/read`, {});
};

export const markAllRead = async (): Promise<void> => {
  await api.patch('user/notifications/read-all', {});
};

export const deleteNotification = async (id: string): Promise<void> => {
  await api.delete(`user/notifications/${id}`);
};

// ─── Grouping helpers ─────────────────────────────────────────────────────────

export type SectionT = { title: string; data: NotificationItem[] };

export const now = () => Date.now();

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const dayDiff = (fromTs: number, toTs: number) => {
  const a = startOfDay(fromTs);
  const b = startOfDay(toTs);
  return Math.floor((a - b) / (24 * 60 * 60 * 1000));
};

export const timeAgo = (ts: number) => {
  const sec = Math.max(1, Math.floor((now() - ts) / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day >= 1) return `${day}D AGO`;
  if (hr >= 1) return `${hr}H AGO`;
  return `${Math.max(1, min)}M AGO`;
};

export const iconFor = (type: NotificationType) => {
  switch (type) {
    case 'GOAL':
      return Trophy;
    case 'CHALLENGE':
      return Zap;
    case 'COIN':
      return Coins;
    case 'HYDRATION':
      return Bell;
    case 'PRODUCT':
      return ShoppingBag;
    case 'SECURITY':
      return ShieldCheck;
    case 'HEART':
      return Heart;
    default:
      return Bell;
  }
};

export const groupSections = (items: NotificationItem[]): SectionT[] => {
  const t = Date.now();

  const today: NotificationItem[] = [];
  const yesterday: NotificationItem[] = [];
  const older: NotificationItem[] = [];

  for (const it of items) {
    const diff = dayDiff(t, it.createdAt);
    if (diff === 0) today.push(it);
    else if (diff === 1) yesterday.push(it);
    else older.push(it);
  }

  const sortDesc = (a: NotificationItem, b: NotificationItem) =>
    b.createdAt - a.createdAt;

  today.sort(sortDesc);
  yesterday.sort(sortDesc);
  older.sort(sortDesc);

  const out: SectionT[] = [];
  if (today.length) out.push({ title: 'TODAY', data: today });
  if (yesterday.length) out.push({ title: 'YESTERDAY', data: yesterday });
  if (older.length) out.push({ title: 'OLDER', data: older });
  return out;
};