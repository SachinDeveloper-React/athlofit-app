import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import BootSplash from 'react-native-bootsplash';
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
import { useAuthStore } from '../features/auth/store/authStore';
import { registerBackgroundSync, stopBackgroundSync } from '../features/health/service/backgroundSync.service';
import { connectivityMonitor } from '../services/connectivityMonitor';
import { syncEngine } from '../services/syncEngine';
import { stepService } from '../services/stepService';

enableScreens(true);

// ─── Google Sign-In — must be called once before any signIn() call ────────────
GoogleSignin.configure({
  webClientId: '248456486264-if00mjj7r7kt7pejjuoh4t5vg3jo6ges.apps.googleusercontent.com',
  iosClientId:
    '248456486264-046ntrivtk80o2u60vt8mudj5mme7gnn.apps.googleusercontent.com',
  offlineAccess: true,
});

// ─── React Query Client ───────────────────────────────────────────────────────
// BUG-042: QueryClient created inside App component (via useState) so it is
// recreated on Fast Refresh and not shared across test evaluations.

// ─── Notifee background event (hydration midnight reset) ─────────────────────
// BUG-041: Wrapped in try/catch — onBackgroundEvent runs in a separate JS
// context where MMKV/Zustand may not be initialised yet.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (
      type === EventType.DELIVERED &&
      detail.notification?.id === 'hydration_midnight_reset'
    ) {
      const { setHistory, setConsumed } = useHydrationStore.getState();
      setHistory([]);
      setConsumed(0);
    }
  } catch (err) {
    console.error('[Background event] hydration reset failed:', err);
  }
});

// ─── App ──────────────────────────────────────────────────────────────────────

// AppShell renders inside QueryClientProvider so hooks like useQueryClient work.
const AppShell: React.FC = () => {
  const { isDark } = useTheme();
  const [isConnectivityReady, setIsConnectivityReady] = useState(false);
  // BUG-043: Stabilise with useCallback so the hydration useEffect dependency
  // array is accurate and the eslint suppression can be removed.
  const checkAndResetIfNewDay = useHydrationStore(
    useCallback((s) => s.checkAndResetIfNewDay, [])
  );
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  // ── Initialize ConnectivityMonitor before navigation renders ──────────────
  // Sets initial offline/online state and wires SyncEngine Zustand subscription
  // so that offline→online transitions trigger queue drain.
  useEffect(() => {
    connectivityMonitor.initialize().then(() => {
      setIsConnectivityReady(true);
    }).catch(() => {
      // Fail-safe: allow app to render even if initialization fails.
      // ConnectivityMonitor defaults to offline on error.
      setIsConnectivityReady(true);
    });

    return () => {
      connectivityMonitor.destroy();
    };
  }, []);

  // ── Hide boot splash on mount ─────────────────────────────────────────────
  useEffect(() => {
    if (!isConnectivityReady) { return; }
    BootSplash.hide({ fade: true }).catch(() => {});
  }, [isConnectivityReady]);

  // ── FCM + Notifee full pipeline (needs QueryClient) ───────────────────────
  useNotificationSetup();

  // ── Background health sync — register when authenticated, stop on logout ──
  useEffect(() => {
    if (isAuthenticated) {
      registerBackgroundSync().catch(() => {});
      // Initialize native step counter (requests permission on Android 10+ and starts service)
      stepService.initialize().catch(() => {});
    } else {
      stopBackgroundSync().catch(() => {});
    }
  }, [isAuthenticated]);

  // ── Hydration midnight reset setup ───────────────────────────────────────
  useEffect(() => {
    checkAndResetIfNewDay();

    notifee.requestPermission().then(settings => {
      if (settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED) {
        Promise.all([
          setupMidnightChannel(),
          setupNotifChannels(),
        ]).then(() => scheduleMidnightReset()).catch(() => {});
      }
    }).catch(() => {});

    const unsubscribe = initAppStateReset();
    const unsubscribeForeground = notifee.onForegroundEvent(
      handleMidnightForegroundEvent,
    );

    return () => {
      unsubscribe();
      unsubscribeForeground();
    };
  }, [checkAndResetIfNewDay]);

  // ── System navigation bar theming ─────────────────────────────────────────
  useEffect(() => {
    SystemNavigationBar.setNavigationColor(
      isDark ? '#000000' : '#ffffff',
    ).catch(() => { });
    SystemNavigationBar.setBarMode(
      isDark ? 'light' : 'dark',
      'navigation',
    ).catch(() => { });
  }, [isDark]);

  // Gate rendering until ConnectivityMonitor has set initial state.
  // This ensures screens mount with the correct offline/online state (Req 1.4, 1.5).
  if (!isConnectivityReady) {
    return null;
  }

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

const App: React.FC = () => {
  // BUG-042: QueryClient created inside App via useState so it is recreated
  // on Fast Refresh and not shared across test evaluations.
  const [queryClient] = React.useState(() => {
    const client = new QueryClient({
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
    // Wire QueryClient into SyncEngine for cache invalidation after drain
    syncEngine.setQueryClient(client);
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
};

export default App;
