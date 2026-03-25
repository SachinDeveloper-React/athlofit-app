// src/components/Header.tsx

import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import { Spacing } from '../constants/spacing';
import { Icon } from './Icon';
import AppView from './AppView';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeaderProps {
  title?: string;
  subtitle?: string;
  largeTitle?: boolean;
  /** Controls title alignment in both standard and large-title layouts */
  titleAlign?: 'left' | 'center';
  showBack?: boolean;
  backLabel?: string;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
  leftAction?: React.ReactNode;
  transparent?: boolean;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  largeTitle = false,
  titleAlign = 'left',
  showBack = false,
  backLabel = 'Back',
  onBackPress,
  rightAction,
  leftAction,
  transparent = false,
  bordered = true,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBackPress) return onBackPress();
    if (navigation.canGoBack()) navigation.goBack();
  };

  const isLeft = titleAlign === 'left';

  const borderStyle = bordered
    ? {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }
    : null;

  const bgStyle = {
    backgroundColor: transparent ? 'transparent' : colors.background,
  };

  // ── Large title layout ────────────────────────────────────────────────────
  if (largeTitle) {
    return (
      <View
        style={[
          styles.largeTitleContainer,
          { paddingTop: insets.top },
          bgStyle,
          borderStyle,
          style,
        ]}
      >
        {/* Top row: back + right action */}
        <View style={styles.largeTitleRow}>
          {showBack ? (
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText variant="body" color={colors.primary}>
                ‹ {backLabel}
              </AppText>
            </TouchableOpacity>
          ) : (
            // Keep right action pushed to the end even without back button
            <View />
          )}
          {rightAction && <View>{rightAction}</View>}
        </View>

        {/* Title block — respects titleAlign */}
        <View
          style={[
            styles.largeTitleText,
            !isLeft && styles.largeTitleTextCenter,
          ]}
        >
          <AppText
            variant="largeTitle"
            weight="bold"
            align={isLeft ? 'left' : 'center'}
          >
            {title}
          </AppText>
          {subtitle && (
            <AppText
              variant="callout"
              align={isLeft ? 'left' : 'center'}
              style={{ marginTop: 2 }}
            >
              {subtitle}
            </AppText>
          )}
        </View>
      </View>
    );
  }

  // ── Standard header — left-aligned ───────────────────────────────────────
  if (isLeft) {
    return (
      <View
        style={[
          styles.containerLeft,
          { paddingTop: insets.top + Spacing[2] },
          bgStyle,
          borderStyle,
          style,
        ]}
      >
        {/* Left: back button or leftAction + title */}
        <View style={styles.leftContent}>
          {showBack && !leftAction && (
            <TouchableOpacity
              onPress={handleBack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.backBtn}
            >
              <AppView row>
                <Icon name="ChevronLeft" />
                <AppText variant="body" color={colors.primary}>
                  {backLabel}
                </AppText>
              </AppView>
            </TouchableOpacity>
          )}
          {leftAction}

          <View style={styles.leftTitleBlock}>
            {title && (
              <AppText variant="headline" numberOfLines={1}>
                {title}
              </AppText>
            )}
            {subtitle && (
              <AppText
                variant="caption1"
                numberOfLines={1}
                style={{ marginTop: 1 }}
              >
                {subtitle}
              </AppText>
            )}
          </View>
        </View>

        {/* Right action */}
        {rightAction && (
          <View style={styles.leftRightAction}>{rightAction}</View>
        )}
      </View>
    );
  }

  // ── Standard header — center-aligned ─────────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing[2] },
        bgStyle,
        borderStyle,
        style,
      ]}
    >
      <View style={styles.side}>
        {showBack && !leftAction && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <AppText variant="body" color={colors.primary}>
              ‹ {backLabel}
            </AppText>
          </TouchableOpacity>
        )}
        {leftAction}
      </View>

      <View style={styles.center}>
        {title && (
          <AppText variant="headline" align="center" numberOfLines={1}>
            {title}
          </AppText>
        )}
        {subtitle && (
          <AppText variant="caption1" align="center" numberOfLines={1}>
            {subtitle}
          </AppText>
        )}
      </View>

      <View style={[styles.side, styles.sideRight]}>{rightAction}</View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Center-aligned standard ──
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    minHeight: 44,
  },
  side: { width: 80, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing[2] },

  // ── Left-aligned standard ──
  containerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[3],
    minHeight: 44,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  leftTitleBlock: { flex: 1 },
  leftRightAction: { paddingLeft: Spacing[3] },

  // ── Shared ──
  backBtn: { paddingVertical: Spacing[1] },

  // ── Large title ──
  largeTitleContainer: { paddingBottom: Spacing[2] },
  largeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    minHeight: 44,
  },
  largeTitleText: {
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[1],
    paddingBottom: Spacing[3],
  },
  largeTitleTextCenter: {
    alignItems: 'center',
  },
});

export default Header;
