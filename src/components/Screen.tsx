import React, { memo, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControlProps,
  ScrollView,
  StatusBar,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import AppView from './AppView';

type Props = {
  children: React.ReactNode;

  bg?: 'background' | 'card';
  safeArea?: boolean;

  /** Forms/long screens => true */
  scroll?: boolean;

  /** Default padding like a real screen */
  padded?: boolean;

  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;

  /**
   * Rendered outside the padded content area (no horizontal padding).
   * Only meaningful when `scroll={true}`.
   * Sticky-positioned at the top of the scroll view.
   */
  header?: React.ReactNode;

  /**
   * Extra space (in px) added between the keyboard top edge and the
   * focused input. Increase if a floating button/tab bar sits above
   * the keyboard.
   * @default 16
   */
  keyboardGap?: number;

  /**
   * Adds bottom inset to prevent content from being obscured
   * by home indicators or floating bottom bars.
   */
  withBottomInset?: boolean;

  bounces?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
};

const Screen = memo(
  ({
    children,
    bg = 'background',
    safeArea = true,
    scroll = false,
    padded = true,
    style,
    contentContainerStyle,
    header,
    keyboardGap = 16,
    bounces = true,
    withBottomInset = true,
    refreshControl,
  }: Props) => {
    const { colors, spacing, isDark } = useTheme();

    const Wrapper = safeArea ? SafeAreaView : View;

    const pad = useMemo<ViewStyle | null>(
      () => (padded ? { paddingHorizontal: spacing[4] } : null),
      [padded, spacing[4]],
    );

    const backgroundColor = colors[bg];
    const barStyle = isDark ? 'light-content' : 'dark-content';
    const bottomInset = withBottomInset ? 100 : 0;

    /**
     * keyboardVerticalOffset:
     *  - iOS  : height of everything ABOVE the KeyboardAvoidingView
     *           (status bar + safe-area top). We add `keyboardGap` here
     *           so the view over-shoots slightly, leaving breathing room
     *           between the keyboard and the focused input.
     *  - Android: translucent StatusBar → the window fills the whole
     *             screen, so offset = 0. Android's
     *             `android:windowSoftInputMode="adjustResize"` handles
     *             the rest; we just add bottom padding for the gap.
     */
    const keyboardOffset =
      Platform.OS === 'ios' ? (StatusBar.currentHeight ?? 0) + keyboardGap : 0;

    return (
      <Wrapper style={[{ flex: 1, backgroundColor }, style]}>
        <StatusBar
          barStyle={barStyle}
          backgroundColor={backgroundColor}
          translucent
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardOffset}
        >
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={bounces}
              contentInset={{ bottom: bottomInset }}
              // Extra bottom padding = inset + gap so the last field
              // is never hidden behind the keyboard on Android.
              contentContainerStyle={{
                flexGrow: 1,
                paddingBottom:
                  Platform.OS === 'android'
                    ? bottomInset + keyboardGap
                    : bottomInset,
              }}
              refreshControl={refreshControl}
              stickyHeaderIndices={header ? [0] : []}
            >
              {/* Header — no horizontal padding, sticky when provided */}
              {header ?? null}

              {/* Main content — padded */}
              <View style={[pad, contentContainerStyle]}>{children}</View>
            </ScrollView>
          ) : (
            <AppView style={[{ flex: 1 }, pad, contentContainerStyle]}>
              {children}
            </AppView>
          )}
        </KeyboardAvoidingView>
      </Wrapper>
    );
  },
);

Screen.displayName = 'Screen';
export default Screen;
