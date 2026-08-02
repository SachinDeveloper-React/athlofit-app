import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Hook to calculate appropriate bottom spacing for floating elements
 * Based on device safe area and platform
 * 
 * Simple approach: Use safe area + standard tab bar height
 * This avoids navigation context dependencies
 */
export const useTabBarHeight = () => {
  const { bottom } = useSafeAreaInsets();

  // Standard tab bar configuration from TabNavigator.tsx:
  // - Height: 60px
  // - Margin bottom: iOS = safe area, Android = safe area + 16px
  // - Additional gap for floating button: 8px
  
  const tabBarHeight = Platform.OS === 'ios' 
    ? 60 + bottom + 8        // Tab height + safe area + gap
    : 60 + bottom + 16 + 8;  // Tab height + safe area + margin + gap

  // For non-tab screens, use minimal spacing
  const defaultSpacing = 20;

  // Since we can't reliably detect tab bar from outside NavigationContainer,
  // we'll use a smart default that works well for both scenarios
  // Users can always override with custom bottom prop
  
  return {
    // Conservative default - works for most tab bars
    bottomSpacing: tabBarHeight,
    // Fallback for non-tab screens (can be used with custom prop)
    minimalSpacing: defaultSpacing,
  };
};
