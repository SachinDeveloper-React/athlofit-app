import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StatusBar, View } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Only import on Android — the module has no iOS native implementation and
// instantiating its NativeEventEmitter on iOS throws an Invariant Violation.
const SystemNavigationBar =
  Platform.OS === 'android'
    ? require('react-native-system-navigation-bar').default
    : null;

/**
 * On Android, wrap the app in KeyboardProvider for react-native-keyboard-controller.
 * On iOS, skip the provider — the native module can conflict with static frameworks
 * and iOS's native keyboard avoidance via KeyboardAvoidingView works without it.
 */
const KeyboardWrapper: React.FC<{ children: React.ReactNode }> =
  Platform.OS === 'android'
    ? ({ children }) => (
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          {children}
        </KeyboardProvider>
      )
    : ({ children }) => <>{children}</>;
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
import { ErrorBoundary, SystemOverlay, WhatsAppSupportButton } from '../components';
import BatteryOptimizationPrompt from '../components/BatteryOptimizationPrompt';
import { useNotificationSetup } from '../hooks/useNotificationSetup';
import { linking } from '../navigation/linkingConfig';
import { useAuthStore } from '../features/auth/store/authStore';
import { registerBackgroundSync, stopBackgroundSync } from '../features/health/service/backgroundSync.service';
import { connectivityMonitor } from '../services/connectivityMonitor';
import { syncEngine } from '../services/syncEngine';
import { stepService } from '../services/stepService';
import { isStepTrackingEnabled, useStepTrackingStore } from '../store/stepTrackingStore';
import { reconcileNativeStepTracking } from '../services/stepTrackingGate';

enableScreens(true);

// ─── Google Sign-In — must be called once before any signIn() call ────────────
GoogleSignin.configure({
  webClientId: '221970537561-ipkq0c3l16in5i82g628h00h9jp3ut92.apps.googleusercontent.com',
  iosClientId: "221970537561-t2gh4srl4rjcrj5v1r24s0eifcp18n2e.apps.googleusercontent.com",
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
  const [isHealthPreChecked, setIsHealthPreChecked] = useState(false);
  // BUG-043: Stabilise with useCallback so the hydration useEffect dependency
  // array is accurate and the eslint suppression can be removed.
  const checkAndResetIfNewDay = useHydrationStore(
    useCallback((s) => s.checkAndResetIfNewDay, [])
  );
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  // ── Initialize ConnectivityMonitor + Health pre-check in parallel ───────────
  // Both run concurrently while splash is visible to minimize cold-start time.
  useEffect(() => {
    const initConnectivity = connectivityMonitor.initialize().catch(() => {});

    // Timeout helper — prevents splash from hanging indefinitely if Health
    // Connect SDK binding dies or requestPermission() never resolves.
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
      Promise.race([
        promise,
        new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), ms)),
      ]);

    const preCheckHealth = async () => {
      if (!isAuthenticated) return;
      try {
        if (Platform.OS === 'android') {
          const { isHealthConnectAvailable, initializeHealthConnect } =
            await import('../features/health/service/healthConnect.service');
          const available = await withTimeout(isHealthConnectAvailable(), 5000);
          if (available) {
            const { widgetService } = await import('../services/widgetService');
            await widgetService.setAppInitialising(true);
            try {
              await withTimeout(initializeHealthConnect(), 10000);
            } finally {
              await widgetService.setAppInitialising(false);
            }
          }
        } else if (Platform.OS === 'ios') {
          const { initializeHealthKit } =
            await import('../features/health/service/healthkit.service');
          await withTimeout(initializeHealthKit(), 10000);
        }
      } catch {
        // Non-fatal — useHealth will retry when TrackerScreen mounts
      }
    };

    Promise.all([initConnectivity, preCheckHealth()]).finally(() => {
      setIsConnectivityReady(true);
      setIsHealthPreChecked(true);
    });

    return () => {
      connectivityMonitor.destroy();
    };
  }, [isAuthenticated]);

  // ── Hide boot splash on mount ─────────────────────────────────────────────
  const [isSplashHidden, setIsSplashHidden] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Subscribed rather than read once, so an admin flipping the switch
  // mid-session (via FCM or a 403) starts/stops the native service immediately
  // instead of at next launch.
  const stepTrackingEnabled = useStepTrackingStore(s => s.enabled);
  
  useEffect(() => {
    if (!isConnectivityReady || !isHealthPreChecked) { return; }
    BootSplash.hide({ fade: true })
      .then(() => {
        // Mark splash as hidden so WhatsApp button can appear
        setIsSplashHidden(true);
      })
      .catch(() => {
        // Even if hide fails, mark as hidden
        setIsSplashHidden(true);
      });
  }, [isConnectivityReady, isHealthPreChecked]);

  const handleSplashComplete = useCallback(() => {
    setIsAppReady(true);
  }, []);

  // ── FCM + Notifee full pipeline (needs QueryClient) ───────────────────────
  useNotificationSetup();

  // ── Background health sync — register when authenticated, stop on logout ──
  useEffect(() => {
    if (isAuthenticated) {
      registerBackgroundSync().catch(() => {});
      // Initialize native step counter (requests permission on Android 10+ and starts service).
      // Skipped when an admin has switched step tracking off for this account —
      // starting the foreground service would resume counting and re-POSTing
      // regardless of the flag, since it runs outside React entirely.
      // Adopt a disable the native side learned about while the app was closed
      // (a background worker's 403), then start or stop accordingly.
      reconcileNativeStepTracking()
        .catch(() => {})
        .finally(() => {
          if (isStepTrackingEnabled()) {
            stepService.initialize().catch(() => {});
          } else {
            stepService.stop().catch(() => {});
          }
        });
    } else {
      stopBackgroundSync().catch(() => {});
    }
  }, [isAuthenticated, stepTrackingEnabled]);

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

  // ── System navigation bar theming (Android only) ───────────────────────────
  //
  // Only the icon appearance, not the bar colour. Under edge-to-edge the window
  // draws behind the navigation bar and React Native's enableEdgeToEdge() has
  // already made it transparent; painting it #000/#fff here would put an opaque
  // strip back over the content on API < 35 and be silently ignored from
  // Android 15 on, so the app would look different depending on the OS version.
  //
  // setBarMode still earns its keep: enableEdgeToEdge() picks light/dark icons
  // from the SYSTEM dark mode, which is not necessarily the theme the user
  // selected inside the app. This keeps the icons legible against whichever
  // background the app is actually showing.
  useEffect(() => {
    if (Platform.OS !== 'android' || !SystemNavigationBar) { return; }
    SystemNavigationBar.setBarMode(
      isDark ? 'light' : 'dark',
      'navigation',
    ).catch(() => { });
  }, [isDark]);

  // Gate rendering until ConnectivityMonitor has set initial state and
  // health permissions are pre-checked (so the user doesn't see PermissionDeniedScreen).
  if (!isConnectivityReady || !isHealthPreChecked) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <KeyboardWrapper>
        {/* Only barStyle: under edge-to-edge the status bar is transparent by
            definition, and StatusBarModule ignores setColor/setTranslucent
            (logging a warning each time) once the feature flag is on. */}
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <NavigationContainer ref={navigationRef} linking={linking}>
          <ToastProvider>
            <RootNavigator onSplashComplete={handleSplashComplete} />
            <SystemOverlay />
            <BatteryOptimizationPrompt />
            {/* Only show WhatsApp button after splash screen is hidden */}
            {isAppReady && isSplashHidden && Platform.OS !== "ios" && <WhatsAppSupportButton />}
          </ToastProvider>
        </NavigationContainer>
      </KeyboardWrapper>
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

  // Outermost, so a throw from any provider below it — navigation, query,
  // safe-area — is caught rather than killing the JS thread.
  return (
    <ErrorBoundary context="appRoot">
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
