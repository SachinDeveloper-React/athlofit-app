import React, { memo, useMemo } from 'react';
import {
  Platform,
  RefreshControlProps,
  ScrollView,
  StatusBar,
  View,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from './KeyboardAvoidingView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useHasTabBar, useTabBarSpace } from '../navigation/tabBarLayout';
import AppView from './AppView';
import { SyncIndicator } from './SyncIndicator';

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
    keyboardGap = 0,
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

    // ── How much room to leave at the bottom ──────────────────────────────────
    //
    // This was a flat `100`, which is the bug behind "content sits under the
    // bottom navigation on some devices". The floating tab bar's footprint is
    // `insets.bottom + gap + height`, so it GROWS with the bottom safe-area inset:
    // about 100dp under gesture navigation, which a hardcoded 100 just cleared,
    // but about 124dp under 3-button navigation, where it fell short and the last
    // row of content ended up beneath the bar and untappable.
    //
    // Only tab screens need this. The tab navigator is a sibling of the pushed
    // stacks in RootNavigator, so the ~30 screens pushed on top of it have no tab
    // bar at all — they keep the original padding, since changing spacing there
    // would be an unrelated visual change.
    const hasTabBar = useHasTabBar();
    const tabBarSpace = useTabBarSpace();
    const bottomInset = withBottomInset ? (hasTabBar ? tabBarSpace : 100) : 0;

    // `tabBarSpace` already contains insets.bottom, so the safe-area wrapper must
    // not add it a second time — dropping the bottom edge lets one thing own the
    // bottom instead of two things half-owning it.
    const safeAreaEdges = hasTabBar
      ? (['top', 'left', 'right'] as const)
      : undefined;

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
      <Wrapper
        edges={safeArea ? safeAreaEdges : undefined}
        style={[{ flex: 1, backgroundColor }, style]}
      >
        {/* barStyle only. The app is edge-to-edge (edgeToEdgeEnabled=true in
            gradle.properties), so the status bar is transparent and always
            drawn behind; StatusBarModule ignores setColor/setTranslucent in
            that mode and logs a warning for each call. */}
        <StatusBar barStyle={barStyle} />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : "height"}
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
              {header ? (
                <View collapsable={false} style={{ zIndex: 10 }}>
                  {header}
                  <SyncIndicator />
                </View>
              ) : (
                <SyncIndicator />
              )}

              {/* Main content — padded, with top spacing below header */}
              <View style={[pad, { paddingTop: header ? spacing[3] : 0 }, contentContainerStyle]}>{children}</View>
            </ScrollView>
          ) : (
            <AppView style={[{ flex: 1 }, contentContainerStyle]}>
              {header ?? null}
              <SyncIndicator />
              <AppView style={[{ flex: 1 }, pad]}>
                {children}
              </AppView>
            </AppView>
          )}
        </KeyboardAvoidingView>
      </Wrapper>
    );
  },
);

Screen.displayName = 'Screen';
export default Screen;
