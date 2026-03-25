// src/components/BottomSheet.tsx

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
  PanResponder,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing, Radius, Shadow } from '../constants/spacing';

const { height: H } = Dimensions.get('window');

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  snapHeight?: number | `${number}%`;
  closeOnBackdrop?: boolean;
  showHandle?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const BottomSheet: React.FC<BottomSheetProps> = ({
  visible,
  onClose,
  title,
  snapHeight,
  closeOnBackdrop = true,
  showHandle = true,
  showCloseButton = false,
  children,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const translateY = useRef(new Animated.Value(H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const sheetHeight =
    typeof snapHeight === 'string'
      ? (parseFloat(snapHeight) / 100) * H
      : snapHeight ?? H * 0.52;

  const springIn = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const slideOut = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: H,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(cb);
  };

  useEffect(() => {
    if (visible) springIn();
    else slideOut();
  }, [visible]);

  const handleClose = () => slideOut(onClose);

  // Drag-to-dismiss
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > sheetHeight * 0.28 || g.vy > 0.9) handleClose();
        else
          Animated.spring(translateY, {
            toValue: 0,
            damping: 20,
            stiffness: 200,
            useNativeDriver: true,
          }).start();
      },
    }),
  ).current;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.backdrop,
          { opacity: backdropAnim },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={closeOnBackdrop ? handleClose : undefined}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            paddingBottom: insets.bottom + Spacing[4],
            backgroundColor: colors.card,
            transform: [{ translateY }],
            borderColor: colors.border,
          },
          isDark && styles.sheetDark,
          style,
        ]}
      >
        {/* Handle */}
        {showHandle && (
          <View {...pan.panHandlers} style={styles.handleArea}>
            <View
              style={[
                styles.handle,
                { backgroundColor: colors.mutedForeground },
              ]}
            />
          </View>
        )}

        {/* Title row */}
        {(title || showCloseButton) && (
          <View style={styles.titleRow}>
            <View style={{ width: 28 }} />
            <AppText variant="headline" style={{ flex: 1 }} align="center">
              {title ?? ''}
            </AppText>
            {showCloseButton ? (
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <View
                  style={[
                    styles.closeCircle,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <AppText
                    variant="caption1"
                    color={colors.mutedForeground}
                    weight="semiBold"
                  >
                    ✕
                  </AppText>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} />
            )}
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: Radius['3xl'],
    borderTopRightRadius: Radius['3xl'],
    borderTopWidth: StyleSheet.hairlineWidth,
    ...Shadow.xl,
  },
  sheetDark: { ...Shadow.none },
  handleArea: { alignItems: 'center', paddingVertical: Spacing[3] },
  handle: { width: 36, height: 4, borderRadius: Radius.full, opacity: 0.35 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[3],
  },
  content: { flex: 1, paddingHorizontal: Spacing[5] },
  closeBtn: {},
  closeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BottomSheet;
