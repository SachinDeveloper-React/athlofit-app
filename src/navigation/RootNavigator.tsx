// src/navigation/RootNavigator.tsx
//
// Auth-gated root navigator.
// - Unauthenticated  → AuthStack (Onboarding → Login → etc.)
// - Authenticated    → TabNavigator (Tracker | Shop | Account)
// - gestureEnabled: false on TabNavigator prevents swipe-back to Login.

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootRoutes } from './routes';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import type { RootStackParamList } from '../types/navigation.types';
import { useAuthStore } from '../features/auth/store/authStore';
import { useOnboardingStore } from '../features/auth/store/onboardingStore';
import ProfileSetupNavigator from './ProfileSetupNavigator';
import HealthNavigator from './HealthNavigator';
import { Screen } from '../components';

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const { isAuthenticated, user, setTokensFromStorage } = useAuthStore();
  const hasFinishedOnboarding = useOnboardingStore(s => s.hasFinished);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      try {
        await setTokensFromStorage(); // reads from react-native-keychain
      } catch {
        // No stored session — user stays on AuthStack
      } finally {
        setIsBootstrapping(false);
      }
    }
    bootstrap();
  }, [setTokensFromStorage]);

  // ── Splash / bootstrap loader ─────────────────────────────────────────────
  if (isBootstrapping) {
    return (
      <Screen scroll={false} style={styles.loader}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </Screen>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
            options={{ gestureEnabled: false, animation: 'fade' }}
          />
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RootNavigator;
