import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthRoutes } from './routes';
import type { AuthStackParamList } from '../types/navigation.types';

// ─── Screens ──────────────────────────────────────────────────────────────────
import OnboardingScreen from '../features/auth/screens/OnboardingScreen';
import LoginScreen from '../features/auth/screens/LoginScreen';
import SignupScreen from '../features/auth/screens/SignupScreen';
import ForgotPasswordScreen from '../features/auth/screens/ForgotPasswordScreen';
import OtpScreen from '../features/auth/screens/OtpScreen';
import ResetPasswordScreen from '../features/auth/screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();
interface AuthNavigatorProps {
  // Passed from RootNavigator — true when user has already seen onboarding
  skipOnboarding?: boolean;
}

const AuthNavigator: React.FC<AuthNavigatorProps> = ({
  skipOnboarding = false,
}) => {
  return (
    <Stack.Navigator
      initialRouteName={
        skipOnboarding ? AuthRoutes.LOGIN : AuthRoutes.ONBOARDING
      }
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name={AuthRoutes.ONBOARDING} component={OnboardingScreen} />
      <Stack.Screen name={AuthRoutes.LOGIN} component={LoginScreen} />
      <Stack.Screen name={AuthRoutes.SIGNUP} component={SignupScreen} />
      <Stack.Screen
        name={AuthRoutes.FORGOT_PASSWORD}
        component={ForgotPasswordScreen}
      />
      <Stack.Screen
        name={AuthRoutes.OTP}
        component={OtpScreen}
        options={{
          // Prevent going back after OTP is sent
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name={AuthRoutes.RESET_PASSWORD}
        component={ResetPasswordScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;
