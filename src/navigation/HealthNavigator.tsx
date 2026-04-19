import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HealthRoutes } from './routes';
import type { HealthStackParamList } from '../types/navigation.types';
import HeartRateScreen from '../features/health/screens/HeartRateScreen';
import BloodPressureScreen from '../features/health/screens/BloodPressureScreen';
import HydrationScreen from '../features/health/screens/HydrationScreen';
import EditStepsGoalScreen from '../features/health/screens/EditStepsGoalScreen';
import HealthAnalyticsScreen from '../features/health/screens/HealthAnalyticsScreen';
import CoinScreen from '../features/health/screens/CoinScreen';
import FoodCatalogScreen from '../features/health/screens/FoodCatalogScreen';
import FoodDetailScreen from '../features/health/screens/FoodDetailScreen';
import BmiCalculatorScreen from '../features/health/screens/BmiCalculatorScreen';
import LeaderboardScreen from '../features/health/screens/LeaderboardScreen';
import StreakScreen from '../features/health/screens/StreakScreen';

const Stack = createNativeStackNavigator<HealthStackParamList>();

const HealthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen
        name={HealthRoutes.HEART_RATE}
        component={HeartRateScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name={HealthRoutes.BLOOD_PRESSURE}
        component={BloodPressureScreen}
      />
      <Stack.Screen
        name={HealthRoutes.HYDRATION}
        component={HydrationScreen}
      />
      <Stack.Screen
        name={HealthRoutes.EDIT_STEPS_GOAL}
        component={EditStepsGoalScreen}
      />
      <Stack.Screen
        name={HealthRoutes.HEALTH_ANALYTICS}
        component={HealthAnalyticsScreen}
      />
      <Stack.Screen
        name={HealthRoutes.COINS}
        component={CoinScreen}
      />
      <Stack.Screen
        name={HealthRoutes.FOOD_CATALOG}
        component={FoodCatalogScreen}
      />
      <Stack.Screen
        name={HealthRoutes.FOOD_DETAIL}
        component={FoodDetailScreen}
      />
      <Stack.Screen
        name={HealthRoutes.BMI_CALCULATOR}
        component={BmiCalculatorScreen}
      />
      <Stack.Screen
        name={HealthRoutes.LEADERBOARD}
        component={LeaderboardScreen}
      />
      <Stack.Screen
        name={HealthRoutes.STREAK}
        component={StreakScreen}
      />
    </Stack.Navigator>
  );
};

export default HealthNavigator;
