// src/app/App.tsx
//
// Root entry point. Wires together:
//   NavigationContainer  →  RootNavigator  →  Auth | Tab
//   React Query          →  server state & caching
//   SafeAreaProvider     →  notch / home bar safety

import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { navigationRef } from '../navigation/navigationRef';
import RootNavigator from '../navigation/RootNavigator';
import { enableScreens } from 'react-native-screens';
import { ToastProvider } from '../components/Toast';
import { useTheme } from '../hooks/useTheme';
import notifee, { EventType } from '@notifee/react-native';
import { useHydrationStore } from '../features/health/store/hydrationStore';
import {
  handleMidnightForegroundEvent,
  initAppStateReset,
  scheduleMidnightReset,
  setupMidnightChannel,
} from '../features/health/service/hydrationMidnightReset.service';
import { SystemOverlay } from '../components';

enableScreens(true);
// ─── React Query Client ───────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

// ─── App ──────────────────────────────────────────────────────────────────────

notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id === 'hydration_midnight_reset'
  ) {
    const { setHistory, setConsumed } = useHydrationStore.getState();
    setHistory([]);
    setConsumed(0);
  }
});

const App: React.FC = () => {
  const { isDark } = useTheme();

  const checkAndResetIfNewDay = useHydrationStore(s => s.checkAndResetIfNewDay);

  useEffect(() => {
    const bootstrap = async () => {
      // a) Reset store if it's a new day (covers app-killed / phone-off case)
      checkAndResetIfNewDay();

      // b) Set up the silent notification channel
      await setupMidnightChannel();

      // c) Schedule the repeating midnight Notifee trigger
      await scheduleMidnightReset();
    };

    bootstrap();

    // d) AppState listener — resets when user opens app on a new day
    const unsubscribe = initAppStateReset();

    // e) Foreground event handler — fires when app is open at midnight
    const unsubscribeForeground = notifee.onForegroundEvent(
      handleMidnightForegroundEvent,
    );

    return () => {
      unsubscribe();
      unsubscribeForeground();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    SystemNavigationBar.setNavigationColor(
      isDark ? '#000000' : '#ffffff',
    ).catch(() => {});
    SystemNavigationBar.setBarMode(
      isDark ? 'light' : 'dark',
      'navigation',
    ).catch(() => {});
  }, [isDark]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
        />
        <NavigationContainer ref={navigationRef}>
          <ToastProvider>
            <RootNavigator />
            <SystemOverlay />
          </ToastProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

export default App;
