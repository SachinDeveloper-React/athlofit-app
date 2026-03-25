import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, Pressable, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import AppText from './AppText';
import { useTheme } from '../hooks/useTheme';
import AppView from './AppView';
import { withOpacity } from '../utils/withOpacity';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TabItem<V extends number | string = number | string> = {
  id: number;
  /** Fixed typo: was `lable` */
  label: string;
  value: V;
};

type Props<V extends number | string = number | string> = {
  tabs: TabItem<V>[];
  activeTab: number;
  onPress?: (value: V) => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_GAP = 8;
const PRESS_IN_DURATION = 90;
const PRESS_OUT_DURATION = 140;
const SLIDE_DURATION = 260;
const PRESS_SCALE = 0.98;

// ─── AnimatedPressable (created once at module level) ─────────────────────────

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── TabButton ────────────────────────────────────────────────────────────────

type TabButtonProps = {
  label: string;
  isActive: boolean;
  tabW: number;
  radius: number;
  paddingV: number;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
};

const TabButton = memo(
  ({
    label,
    isActive,
    tabW,
    radius,
    paddingV,
    activeColor,
    inactiveColor,
    onPress,
  }: TabButtonProps) => {
    const scale = useSharedValue(1);

    const aStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePress = useCallback(() => {
      scale.value = withTiming(
        PRESS_SCALE,
        { duration: PRESS_IN_DURATION },
        () => {
          scale.value = withTiming(1, { duration: PRESS_OUT_DURATION });
        },
      );
      onPress();
    }, [onPress, scale]);

    // Stable style — only depends on tabW, paddingV, radius, not on isActive
    // so the Pressable itself never re-renders for color changes
    const containerStyle = useMemo(
      () => ({
        width: tabW,
        padding: paddingV,
        borderRadius: radius,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
      }),
      [tabW, paddingV, radius],
    );

    const textColor = isActive ? activeColor : inactiveColor;

    return (
      <AnimatedPressable
        role="tab"
        aria-selected={isActive}
        onPress={handlePress}
        style={[containerStyle, aStyle]}
      >
        <AppText
          variant="caption1"
          style={[styles.label, { color: textColor }]}
        >
          {label.toUpperCase()}
        </AppText>
      </AnimatedPressable>
    );
  },
  // Custom comparator — skip re-render if only `isActive` flips on inactive→inactive
  (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (prev.label !== next.label) return false;
    if (prev.tabW !== next.tabW) return false;
    if (prev.paddingV !== next.paddingV) return false;
    if (prev.radius !== next.radius) return false;
    if (prev.activeColor !== next.activeColor) return false;
    if (prev.inactiveColor !== next.inactiveColor) return false;
    if (prev.onPress !== next.onPress) return false;
    return true;
  },
);

TabButton.displayName = 'TabButton';

// ─── AppTabs ──────────────────────────────────────────────────────────────────

const AppTabsInner = <V extends number | string>({
  tabs,
  activeTab,
  onPress,
}: Props<V>) => {
  const { spacing, colors, radius, fontSize, shadow } = useTheme();
  const [containerW, setContainerW] = useState(0);

  // ── Derived values ──────────────────────────────────────────────────────────

  const paddingH = spacing[1];

  const tabW = useMemo(() => {
    if (!containerW || !tabs.length) return 0;
    const totalGaps = TAB_GAP * (tabs.length - 1);
    return (containerW - paddingH * 2 - totalGaps) / tabs.length;
  }, [containerW, tabs.length, paddingH]);

  const activeIndex = useMemo(() => {
    const idx = tabs.findIndex(t => t.id === activeTab);
    return idx < 0 ? 0 : idx;
  }, [tabs, activeTab]);

  // ── Slide animation ─────────────────────────────────────────────────────────

  const tx = useSharedValue(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (!tabW) return;
    const targetX = paddingH + activeIndex * (tabW + TAB_GAP);

    if (isFirstRender.current) {
      // Snap on first render — no animation flash
      tx.value = targetX;
      isFirstRender.current = false;
      return;
    }

    tx.value = withTiming(targetX, {
      duration: SLIDE_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeIndex, tabW, paddingH, tx]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  // ── Layout ──────────────────────────────────────────────────────────────────

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    // Guard against no-op layout events (e.g. fast refresh)
    setContainerW(prev => (prev === w ? prev : w));
  }, []);

  // ── Stable per-tab press handlers ───────────────────────────────────────────
  // Keyed by tab id so handlers are recreated only when the tabs array changes,
  // not on every parent render.
  const pressHandlers = useMemo(() => {
    const map = new Map<number, () => void>();
    for (const tab of tabs) {
      map.set(tab.id, () => onPress?.(tab.value));
    }
    return map;
  }, [tabs, onPress]);

  // ── Indicator shadow ────────────────────────────────────────────────────────

  const indicatorBaseStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      top: paddingH,
      bottom: paddingH,
      width: tabW,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
      ...Platform.select({
        ios: shadow.lg,
        android: shadow.lg,
      }),
    }),
    [paddingH, tabW, radius.sm, colors.background],
  );

  return (
    <AppView
      onLayout={onLayout}
      style={[
        styles.container,
        {
          backgroundColor: withOpacity(colors.accent, 0.4),
          padding: paddingH,
          borderRadius: radius.sm,
        },
      ]}
    >
      {/* Sliding background indicator */}
      {!!tabW && (
        <Animated.View
          pointerEvents="none"
          style={[indicatorBaseStyle, indicatorStyle]}
        />
      )}

      {tabs.map(item => (
        <TabButton
          key={item.id}
          label={item.label}
          isActive={item.id === activeTab}
          tabW={tabW}
          radius={radius.sm}
          paddingV={spacing[1]}
          activeColor={colors.primary}
          inactiveColor={colors.foreground}
          onPress={pressHandlers.get(item.id)!}
        />
      ))}
    </AppView>
  );
};

export const Tabs = memo(AppTabsInner) as typeof AppTabsInner;

// ─── Static styles ────────────────────────────────────────────────────────────

// Keeping StyleSheet-equivalent objects here avoids react-native import just
// for StyleSheet.create — but if you already import StyleSheet elsewhere,
// move these there.
const styles = {
  container: {
    flexDirection: 'row' as const,
    gap: TAB_GAP,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  label: {
    fontSize: 10,
    textAlign: 'center' as const,
    letterSpacing: 1,
    fontWeight: '600' as const,
  },
};
