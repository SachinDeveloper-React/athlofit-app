import React, { Suspense } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HealthRoutes } from './routes';
import type { HealthStackParamList } from '../types/navigation.types';

// ─── Lazy imports ─────────────────────────────────────────────────────────────
//
// HeartRateScreen imports react-native-vision-camera and react-native-worklets-core.
// Both libraries initialise a native JSI/worklet runtime at module evaluation time.
// Eagerly importing them causes a SIGSEGV (signal 11) crash on Android because the
// native runtime is created before the React Native bridge is fully ready.
//
// React.lazy defers the import (and therefore the native init) until the user
// actually navigates to the screen — by which point the bridge is stable.
//
const HeartRateScreen    = React.lazy(() => import('../features/health/screens/HeartRateScreen'));
const BloodPressureScreen = React.lazy(() => import('../features/health/screens/BloodPressureScreen'));

// Screens with no heavy native init — eager imports are fine
import HydrationScreen from '../features/health/screens/HydrationScreen';
import EditStepsGoalScreen from '../features/health/screens/EditStepsGoalScreen';
import EditHydrationGoalScreen from '../features/health/screens/EditHydrationGoalScreen';
import HealthAnalyticsScreen from '../features/health/screens/HealthAnalyticsScreen';
import CoinScreen from '../features/health/screens/CoinScreen';
import FoodCatalogScreen from '../features/health/screens/FoodCatalogScreen';
import FoodDetailScreen from '../features/health/screens/FoodDetailScreen';
import BmiCalculatorScreen from '../features/health/screens/BmiCalculatorScreen';
import LeaderboardScreen from '../features/health/screens/LeaderboardScreen';
import StreakScreen from '../features/health/screens/StreakScreen';
import ChallengesScreen from '../features/health/screens/ChallengesScreen';
import ChallengeDetailScreen from '../features/health/screens/ChallengeDetailScreen';
import StepDetailScreen from '../features/health/screens/StepDetailScreen';
import StepSourcesScreen from '../features/health/screens/StepSourcesScreen';
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<HealthStackParamList>();

// Minimal fallback shown while the lazy screen chunk loads (usually <100ms)
const LazyFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator />
  </View>
);

const HealthNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name={HealthRoutes.HEART_RATE} options={{ gestureEnabled: false }}>
        {props => (
          <Suspense fallback={<LazyFallback />}>
            <HeartRateScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen name={HealthRoutes.BLOOD_PRESSURE}>
        {props => (
          <Suspense fallback={<LazyFallback />}>
            <BloodPressureScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>

      <Stack.Screen name={HealthRoutes.HYDRATION}        component={HydrationScreen} />
      <Stack.Screen name={HealthRoutes.EDIT_STEPS_GOAL}  component={EditStepsGoalScreen} />
      <Stack.Screen name={HealthRoutes.EDIT_HYDRATION_GOAL} component={EditHydrationGoalScreen} />
      <Stack.Screen name={HealthRoutes.HEALTH_ANALYTICS} component={HealthAnalyticsScreen} />
      <Stack.Screen name={HealthRoutes.COINS}            component={CoinScreen} />
      <Stack.Screen name={HealthRoutes.FOOD_CATALOG}     component={FoodCatalogScreen} />
      <Stack.Screen name={HealthRoutes.FOOD_DETAIL}      component={FoodDetailScreen} />
      <Stack.Screen name={HealthRoutes.BMI_CALCULATOR}   component={BmiCalculatorScreen} />
      <Stack.Screen name={HealthRoutes.LEADERBOARD}      component={LeaderboardScreen} />
      <Stack.Screen name={HealthRoutes.STREAK}           component={StreakScreen} />
      <Stack.Screen name={HealthRoutes.CHALLENGES}       component={ChallengesScreen} />
      <Stack.Screen name={HealthRoutes.CHALLENGE_DETAIL} component={ChallengeDetailScreen} />
      <Stack.Screen name={HealthRoutes.STEP_DETAIL}      component={StepDetailScreen} />
      <Stack.Screen name={HealthRoutes.STEP_SOURCES}     component={StepSourcesScreen} />
    </Stack.Navigator>
  );
};

export default HealthNavigator;
