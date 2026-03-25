import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ProfileSetupRoutes } from './routes';
import CompleteProfileScreen from '../features/account/screens/CompleteProfileScreen';
import type { ProfileSetupStackParamList } from '../types/navigation.types';

const Stack = createNativeStackNavigator<ProfileSetupStackParamList>();

const ProfileSetupNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name={ProfileSetupRoutes.COMPLETE_PROFILE}
        component={CompleteProfileScreen}
        options={{ gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
};

export default ProfileSetupNavigator;
