import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootRoutes } from './routes';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import type { RootStackParamList } from '../types/navigation.types';
import { useAuthStore } from '../features/auth/store/authStore';
import { useOnboardingStore } from '../features/auth/store/onboardingStore';
import ProfileSetupNavigator from './ProfileSetupNavigator';
import HealthNavigator from './HealthNavigator';
import SplashScreen from '../features/auth/screens/SplashScreen';
import AccountNavigator from './AccountNavigator';
import ShopNavigator from './ShopNavigator';
import { CartProvider } from '../features/shop/context/CartContext';
import { useAppConfig } from '../hooks/useAppConfig';
import { useTheme } from '../hooks/useTheme';
import { useHealthInitStore } from '../features/health/store/healthInitStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { isAuthenticated, user, setTokensFromStorage } = useAuthStore();
  const hasFinishedOnboarding = useOnboardingStore(s => s.hasFinished);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const { colors } = useTheme();

  // Fetch live server config (coin rate, step goals, feature flags)
  // Only runs when authenticated; falls back to persisted/default config
  useAppConfig();

  useEffect(() => {
    // Minimum splash duration (ms) — prevents a jarring flash on fast devices
    const MIN_SPLASH_MS = 800;
    const startTime = Date.now();

    async function bootstrap(): Promise<void> {
      try {
        await setTokensFromStorage();

        // Pre-initialize health SDK during splash so TrackerScreen opens directly
        // without flashing the permission screen. Only run if user is authenticated.
        const authState = useAuthStore.getState();
        if (authState.isAuthenticated && authState.user?.isProfileCompleted) {
          await useHealthInitStore.getState().initialize();
        }
      } catch {
        // No stored session — user stays on AuthStack
      } finally {
        // Ensure splash shows for at least MIN_SPLASH_MS
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
        setTimeout(() => setIsBootstrapping(false), remaining);
      }
    }
    bootstrap();
  }, [setTokensFromStorage]);

  // ── Splash / bootstrap loader ─────────────────────────────────────────────
  if (isBootstrapping) {
    return <SplashScreen />;
  }

  return (
    <CartProvider>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {!isAuthenticated ? (
          // ── State 1 & 2: Not logged in ──────────────────────────────────────
          <Stack.Screen
            name={RootRoutes.AUTH_STACK}
            options={{ animation: 'none' }}
          >
            {() => <AuthNavigator skipOnboarding={hasFinishedOnboarding} />}
          </Stack.Screen>
        ) : !user?.isProfileCompleted ? (
          // ── State 3: Logged in but profile incomplete ────────────────────────
          <Stack.Screen
            name={RootRoutes.PROFILE_SETUP_STACK}
            component={ProfileSetupNavigator}
            options={{ gestureEnabled: false, animation: 'slide_from_bottom' }}
          />
        ) : (
          // ── State 4: Fully authenticated + profile complete ──────────────────
          <Stack.Group>
            <Stack.Screen
              name={RootRoutes.TAB_NAVIGATOR}
              component={TabNavigator}
              options={{ gestureEnabled: false, animation: 'fade' }}
            />
            <Stack.Screen
              name={RootRoutes.HEALTH_NAVIGATOR}
              component={HealthNavigator}
              options={{ gestureEnabled: true, animation: 'slide_from_right', fullScreenGestureEnabled: true }}
            />
            <Stack.Screen
              name={RootRoutes.ACCOUNT_NAVIGATOR}
              component={AccountNavigator}
              options={{ gestureEnabled: true, animation: 'slide_from_right', fullScreenGestureEnabled: true }}
            />
            <Stack.Screen
              name={RootRoutes.SHOP_NAVIGATOR}
              component={ShopNavigator}
              options={{ gestureEnabled: true, animation: 'slide_from_right', fullScreenGestureEnabled: true }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </CartProvider>
  );
};

export default RootNavigator;
