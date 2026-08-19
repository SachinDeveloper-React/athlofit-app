// src/navigation/tabBarLayout.ts
// ─── Geometry of the floating bottom tab bar ─────────────────────────────────
//
// The tab bar is `position: 'absolute'` and deliberately translucent, so content
// scrolls UNDERNEATH it. That only works if every screen behind it knows how much
// room it occupies and pads its scrollable content by that much, so the LAST item
// still comes to rest above the bar.
//
// Nothing knew. The bar computed its own geometry in TabNavigator.tsx, while the
// screens behind it guessed with a hardcoded `100` written separately into
// Screen.tsx and TrackerScreen.tsx. The guess was wrong in a way that only showed
// up on some phones, because the bar's footprint SCALES with the bottom safe-area
// inset and a constant does not:
//
//     bar top edge above the window bottom = insets.bottom + GAP + HEIGHT
//
//   · Gesture navigation  — insets.bottom ≈ 24dp → needs ≈ 100dp. The guess of
//     100 just barely cleared it, which is why this looked fine in testing.
//   · 3-button navigation — insets.bottom ≈ 48dp → needs ≈ 124dp. The guess fell
//     ~24dp short, so the last row of content sat under the bar and could not be
//     tapped.
//
// Hence: one module, one definition, used by the bar to lay itself out AND by the
// screens to keep clear of it. They cannot drift apart again.

import { Platform } from 'react-native';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';

/** Height of the bar itself. */
export const TAB_BAR_HEIGHT = 60;

/**
 * Gap between the bar and the system navigation bar below it.
 *
 * Android only — on iOS the bar sits directly on the home-indicator inset, which
 * is what the original `marginBottom: ios ? bottom : bottom + 16` expressed.
 */
export const TAB_BAR_GAP = Platform.OS === 'ios' ? 0 : 16;

/**
 * Vertical space the floating tab bar occupies, measured from the bottom of the
 * window — i.e. the distance up to the bar's top edge.
 *
 * This ALREADY INCLUDES the bottom safe-area inset. A container that is also
 * safe-area padded at the bottom must therefore not add both, or the inset is
 * counted twice; see how Screen.tsx drops its bottom edge when a tab bar is
 * present.
 */
export function useTabBarSpace(): number {
  const { bottom } = useSafeAreaInsets();
  return bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT;
}

/**
 * Whether the calling component is rendered inside the bottom tab navigator, and
 * so has the floating bar over it.
 *
 * The tab navigator is a SIBLING of the pushed stacks in RootNavigator, not their
 * parent, so most screens in the app have no tab bar at all and must not reserve
 * room for one. Reading the context directly (rather than useBottomTabBarHeight,
 * which throws outside a tab navigator) makes this a safe question to ask from a
 * shared component that is used in both places.
 */
export function useHasTabBar(): boolean {
  return useContext(BottomTabBarHeightContext) !== undefined;
}
