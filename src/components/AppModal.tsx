// src/components/AppModal.tsx

import React, { useEffect, useRef } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Dimensions,
} from 'react-native';
import AppText from './AppText';
import Button from './Button';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius, Shadow } from '../constants/spacing';

const { width: W } = Dimensions.get('window');

interface ModalAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
}

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions?: ModalAction[];
  closeOnBackdrop?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const AppModal: React.FC<AppModalProps> = ({
  visible,
  onClose,
  title,
  message,
  actions = [],
  closeOnBackdrop = true,
  children,
  style,
}) => {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(0.86)).current;
  const op = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          damping: 18,
          stiffness: 250,
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 0.92,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(op, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: op }]}
      >
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
              borderColor: colors.border,
              opacity: op,
              transform: [{ scale }],
            },
            !isDark && Shadow.xl,
            isDark && styles.dialogDarkBorder,
            style,
          ]}
        >
          {/* Header */}
          {(title || message) && (
            <View style={styles.header}>
              {title && (
                <AppText
                  variant="headline"
                  align="center"
                  style={styles.titleText}
                >
                  {title}
                </AppText>
              )}
              {message && (
                <AppText variant="callout" align="center">
                  {message}
                </AppText>
              )}
            </View>
          )}

          {children}

          {/* Actions — iOS style: stacked for 2 actions, side-by-side for 1 */}
          {actions.length > 0 && (
            <>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
              {actions.length === 1 ? (
                <TouchableOpacity
                  onPress={actions[0].onPress}
                  style={styles.singleAction}
                >
                  <AppText
                    variant="body"
                    align="center"
                    color={
                      actions[0].variant === 'destructive'
                        ? colors.destructive
                        : colors.primary
                    }
                    weight="semiBold"
                  >
                    {actions[0].label}
                  </AppText>
                </TouchableOpacity>
              ) : (
                <View style={styles.actionsRow}>
                  {actions.map((a, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <View
                          style={[
                            styles.actionDividerV,
                            { backgroundColor: colors.border },
                          ]}
                        />
                      )}
                      <TouchableOpacity
                        onPress={a.onPress}
                        style={styles.actionBtn}
                      >
                        <AppText
                          variant="body"
                          align="center"
                          color={
                            a.variant === 'destructive'
                              ? colors.destructive
                              : i === 0
                              ? colors.mutedForeground
                              : colors.primary
                          }
                          weight={
                            i === actions.length - 1 ? 'semiBold' : 'regular'
                          }
                        >
                          {a.label}
                        </AppText>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  centerer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing[8],
  },
  dialog: {
    width: W - Spacing[8] * 2,
    borderRadius: Radius['2xl'],
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  dialogDarkBorder: { borderWidth: StyleSheet.hairlineWidth },
  header: { padding: Spacing[5], paddingBottom: Spacing[4] },
  titleText: { marginBottom: Spacing[1] },
  divider: { height: StyleSheet.hairlineWidth, width: '100%' },
  singleAction: { padding: Spacing[4], alignItems: 'center' },
  actionsRow: { flexDirection: 'row' },
  actionBtn: { flex: 1, padding: Spacing[4], alignItems: 'center' },
  actionDividerV: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
});

export default AppModal;

// ─── Usage ────────────────────────────────────────────────────────────────────
// <AppModal
//   visible={show}
//   onClose={() => setShow(false)}
//   title="Delete record?"
//   message="This action cannot be undone."
//   actions={[
//     { label: 'Cancel',  onPress: () => setShow(false) },
//     { label: 'Delete',  onPress: handleDelete, variant: 'destructive' },
//   ]}
// />
