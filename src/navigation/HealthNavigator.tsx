import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HealthRoutes } from './routes';
import type { HealthStackParamList } from '../types/navigation.types';
import HeartRateScreen from '../features/health/screens/HeartRateScreen';
import BloodPressureScreen from '../features/health/screens/BloodPressureScreen';
import HydrationScreen from '../features/health/screens/HydrationScreen';

const Stack = createNativeStackNavigator<HealthStackParamList>();

const HealthNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name={HealthRoutes.HEART_RATE}
        component={HeartRateScreen}
        options={{ gestureEnabled: false }}
      />
      <Stack.Screen
        name={HealthRoutes.BLOOD_PRESSURE}
        component={BloodPressureScreen}
        options={{ animation: 'ios_from_right' }}
      />
      <Stack.Screen
        name={HealthRoutes.HYDRATION}
        component={HydrationScreen}
        options={{ animation: 'ios_from_right' }}
      />
    </Stack.Navigator>
  );
};

export default HealthNavigator;
