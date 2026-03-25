// src/components/Toast.tsx

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  View,
  Animated,
  StyleSheet,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius, Shadow } from '../constants/spacing';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Single Toast ─────────────────────────────────────────────────────────────

const Toast: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({
  item,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();
  const ty = useRef(new Animated.Value(-100)).current;
  const op = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  const iconMap: Record<
    ToastType,
    { icon: string; color: string; bg: string }
  > = {
    success: { icon: '✓', color: '#FFFFFF', bg: colors.success },
    error: { icon: '✕', color: '#FFFFFF', bg: colors.destructive },
    warning: { icon: '!', color: '#FFFFFF', bg: colors.warning },
    info: { icon: 'i', color: '#FFFFFF', bg: colors.primary },
  };

  const cfg = iconMap[item.type];

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(ty, {
        toValue: -100,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(item.id));
  };

  useEffect(() => {
    Animated.parallel([
      Animated.spring(ty, {
        toValue: 0,
        damping: 16,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.timing(op, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 16,
        stiffness: 220,
        useNativeDriver: true,
      }),
    ]).start();
    const t = setTimeout(dismiss, item.duration);
    return () => clearTimeout(t);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: isDark ? colors.card : '#1C1C1E',
          opacity: op,
          transform: [{ translateY: ty }, { scale }],
          borderColor: isDark ? colors.border : 'transparent',
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
        },
        Shadow.lg,
      ]}
    >
      {/* Icon pill */}
      <View style={[styles.iconPill, { backgroundColor: cfg.bg }]}>
        <AppText variant="caption2" weight="bold" color={cfg.color}>
          {cfg.icon}
        </AppText>
      </View>

      {/* Message */}
      <AppText
        variant="subhead"
        color="#FFFFFF"
        style={styles.msg}
        numberOfLines={2}
      >
        {item.message}
      </AppText>

      {/* Dismiss */}
      <TouchableOpacity
        onPress={dismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <AppText variant="caption1" color="rgba(255,255,255,0.45)">
          ✕
        </AppText>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (message: string, type: ToastType = 'info', duration = 3200) => {
      setToasts(prev => [
        ...prev.slice(-2),
        { id: `${Date.now()}`, message, type, duration },
      ]);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ctx: ToastContextValue = {
    show,
    success: m => show(m, 'success'),
    error: m => show(m, 'error'),
    warning: m => show(m, 'warning'),
    info: m => show(m, 'info'),
  };

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View
        style={[styles.container, { top: insets.top + Spacing[2] }]}
        pointerEvents="box-none"
      >
        {toasts.map(t => (
          <Toast key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be called inside <ToastProvider>');
  return ctx;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing[4],
    right: Spacing[4],
    zIndex: 9999,
    gap: Spacing[2],
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius['2xl'],
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  iconPill: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msg: { flex: 1 },
});
