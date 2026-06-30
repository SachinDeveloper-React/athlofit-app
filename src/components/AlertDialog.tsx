// ─── AlertDialog.tsx ───────────────────────────────────────────────────────────
// Custom attractive alert dialog with success and error variants.
// Replaces native Alert.alert with animated, themed modals.

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AppText from './AppText';
import { Icon } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { Spacing, Radius, Shadow } from '../constants/spacing';

const { width: W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
}

export interface AlertDialogProps {
  visible: boolean;
  onClose: () => void;
  variant?: AlertVariant;
  title: string;
  message?: string;
  /** Rich content lines (emoji + text pairs) */
  details?: { emoji: string; text: string }[];
  actions?: AlertAction[];
  closeOnBackdrop?: boolean;
}

// ─── Variant Config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG = {
  success: {
    iconName: 'CheckCircle2' as const,
    gradient: ['#10B981', '#059669'],
    iconBg: '#ECFDF5',
    iconColor: '#059669',
    accentColor: '#10B981',
  },
  error: {
    iconName: 'XCircle' as const,
    gradient: ['#EF4444', '#DC2626'],
    iconBg: '#FEF2F2',
    iconColor: '#DC2626',
    accentColor: '#EF4444',
  },
  warning: {
    iconName: 'AlertTriangle' as const,
    gradient: ['#F59E0B', '#D97706'],
    iconBg: '#FFFBEB',
    iconColor: '#D97706',
    accentColor: '#F59E0B',
  },
  info: {
    iconName: 'Info' as const,
    gradient: ['#0099FF', '#0066CC'],
    iconBg: '#EFF6FF',
    iconColor: '#0066CC',
    accentColor: '#0099FF',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

const AlertDialog: React.FC<AlertDialogProps> = ({
  visible,
  onClose,
  variant = 'info',
  title,
  message,
  details,
  actions = [],
  closeOnBackdrop = true,
}) => {
  const { colors, isDark } = useTheme();
  const config = VARIANT_CONFIG[variant];

  // Animations
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          damping: 15,
          stiffness: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Staggered entrance for icon and content
        Animated.sequence([
          Animated.spring(iconScale, {
            toValue: 1,
            damping: 10,
            stiffness: 300,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(contentY, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    } else {
      iconScale.setValue(0);
      contentY.setValue(20);
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.85,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getButtonStyle = (action: AlertAction, index: number, total: number) => {
    const isLast = index === total - 1;
    const v = action.variant || (isLast ? 'primary' : 'outline');

    switch (v) {
      case 'primary':
        return {
          bg: config.accentColor,
          textColor: '#FFFFFF',
          borderColor: 'transparent',
        };
      case 'destructive':
        return {
          bg: colors.destructive,
          textColor: '#FFFFFF',
          borderColor: 'transparent',
        };
      case 'outline':
        return {
          bg: 'transparent',
          textColor: isDark ? colors.foreground : colors.foreground,
          borderColor: colors.border,
        };
      case 'ghost':
      default:
        return {
          bg: 'transparent',
          textColor: colors.mutedForeground,
          borderColor: 'transparent',
        };
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={closeOnBackdrop ? onClose : undefined}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Dialog */}
      <View style={styles.centerer} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.dialog,
            {
              backgroundColor: colors.card,
              borderColor: isDark ? colors.border : withOpacity(config.accentColor, 0.15),
              opacity,
              transform: [{ scale }],
            },
            !isDark && Shadow.xl,
          ]}
        >
          {/* Top accent bar */}
          <View style={[styles.accentBar, { backgroundColor: config.accentColor }]} />

          {/* Icon circle */}
          <Animated.View
            style={[
              styles.iconCircle,
              {
                backgroundColor: isDark
                  ? withOpacity(config.accentColor, 0.15)
                  : config.iconBg,
                borderColor: withOpacity(config.accentColor, 0.2),
                transform: [{ scale: iconScale }],
              },
            ]}
          >
            <Icon name={config.iconName as any} size={32} color={config.iconColor} />
          </Animated.View>

          {/* Content */}
          <Animated.View
            style={[
              styles.content,
              { transform: [{ translateY: contentY }] },
            ]}
          >
            <AppText variant="title3" weight="bold" align="center" style={styles.title}>
              {title}
            </AppText>

            {message && (
              <AppText
                variant="subhead"
                align="center"
                color={colors.mutedForeground}
                style={styles.message}
              >
                {message}
              </AppText>
            )}

            {/* Detail rows */}
            {details && details.length > 0 && (
              <View
                style={[
                  styles.detailsCard,
                  {
                    backgroundColor: isDark
                      ? withOpacity(colors.foreground, 0.04)
                      : withOpacity(config.accentColor, 0.04),
                    borderColor: withOpacity(config.accentColor, 0.1),
                  },
                ]}
              >
                {details.map((d, i) => (
                  <View key={i} style={styles.detailRow}>
                    <AppText style={styles.detailEmoji}>{d.emoji}</AppText>
                    <AppText variant="subhead" weight="medium" style={{ flex: 1 }}>
                      {d.text}
                    </AppText>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Action buttons */}
          {actions.length > 0 && (
            <View style={styles.actionsContainer}>
              {actions.map((action, i) => {
                const btnStyle = getButtonStyle(action, i, actions.length);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={action.onPress}
                    activeOpacity={0.8}
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: btnStyle.bg,
                        borderColor: btnStyle.borderColor,
                        borderWidth: btnStyle.borderColor === 'transparent' ? 0 : 1.5,
                      },
                      actions.length === 1 && { flex: 1 },
                    ]}
                  >
                    <AppText
                      variant="subhead"
                      weight="bold"
                      color={btnStyle.textColor}
                      align="center"
                    >
                      {action.label}
                    </AppText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

export default AlertDialog;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centerer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[6],
  },
  dialog: {
    width: W - Spacing[6] * 2,
    maxWidth: 360,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 24,
    borderWidth: 2,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    marginBottom: 6,
  },
  message: {
    marginBottom: 12,
    lineHeight: 22,
  },
  detailsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginTop: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailEmoji: {
    fontSize: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
