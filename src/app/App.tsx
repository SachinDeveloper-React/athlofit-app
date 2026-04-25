import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SystemNavigationBar from 'react-native-system-navigation-bar';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import notifee, { AuthorizationStatus, EventType } from '@notifee/react-native';
import { navigationRef } from '../navigation/navigationRef';
import RootNavigator from '../navigation/RootNavigator';
import { enableScreens } from 'react-native-screens';
import { ToastProvider } from '../components/Toast';
import { useTheme } from '../hooks/useTheme';
import { useHydrationStore } from '../features/health/store/hydrationStore';
import {
  handleMidnightForegroundEvent,
  initAppStateReset,
  scheduleMidnightReset,
  setupMidnightChannel,
} from '../features/health/service/hydrationMidnightReset.service';
import { setupNotifChannels } from '../features/health/hooks/useSyncHealth';
import { SystemOverlay } from '../components';
import { useNotificationSetup } from '../hooks/useNotificationSetup';
import { linking } from '../navigation/linkingConfig';

enableScreens(true);

// ─── Google Sign-In — must be called once before any signIn() call ────────────
GoogleSignin.configure({
  webClientId: '248456486264-if00mjj7r7kt7pejjuoh4t5vg3jo6ges.apps.googleusercontent.com',
  iosClientId:
      '248456486264-046ntrivtk80o2u60vt8mudj5mme7gnn.apps.googleusercontent.com',
  offlineAccess: true,
});

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

// ─── Notifee background event (hydration midnight reset) ─────────────────────

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

// ─── App ──────────────────────────────────────────────────────────────────────

// AppShell renders inside QueryClientProvider so hooks like useQueryClient work.
const AppShell: React.FC = () => {
  const { isDark } = useTheme();
  const checkAndResetIfNewDay = useHydrationStore(s => s.checkAndResetIfNewDay);

  // ── FCM + Notifee full pipeline (needs QueryClient) ───────────────────────
  useNotificationSetup();

  // ── Hydration midnight reset setup ───────────────────────────────────────
  useEffect(() => {
    const bootstrap = async () => {
      checkAndResetIfNewDay();

      const settings = await notifee.requestPermission();
      if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
        await Promise.all([
          setupMidnightChannel(),
          setupNotifChannels(),
        ]);
        await scheduleMidnightReset();
      }
    };

    bootstrap();

    const unsubscribe = initAppStateReset();
    const unsubscribeForeground = notifee.onForegroundEvent(
      handleMidnightForegroundEvent,
    );

    return () => {
      unsubscribe();
      unsubscribeForeground();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── System navigation bar theming ─────────────────────────────────────────
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
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
      />
      <NavigationContainer ref={navigationRef} linking={linking}>
        <ToastProvider>
          <RootNavigator />
          <SystemOverlay />
        </ToastProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AppShell />
  </QueryClientProvider>
);

export default App;
