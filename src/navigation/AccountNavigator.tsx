import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AccountStackParamList } from '../types/navigation.types';
import AccountScreen from '../features/account/screens/AccountScreen';
import { AccountRoutes } from './routes';
import SettingsScreen from '../features/account/screens/SettingsScreen';
import EditProfileScreen from '../features/account/screens/EditProfileScreen';
import NotificationsScreen from '../features/account/screens/NotificationsScreen';
import PrivacyScreen from '../features/account/screens/PrivacyScreen';
import TermsScreen from '../features/account/screens/TermsScreen';
import HelpSupportScreen from '../features/account/screens/HelpSupportScreen';
import AchievementsScreen from '../features/account/screens/AchievementsScreen';
import ReferralScreen from '../features/account/screens/ReferralScreen';

const Stack = createNativeStackNavigator<AccountStackParamList>();
const AccountNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={AccountRoutes.ACCOUNT} component={AccountScreen} />
      <Stack.Screen name={AccountRoutes.SETTINGS} component={SettingsScreen} />
      <Stack.Screen
        name={AccountRoutes.EDIT_PROFILE}
        component={EditProfileScreen}
      />
      <Stack.Screen
        name={AccountRoutes.NOTIFICATIONS}
        component={NotificationsScreen}
      />
      <Stack.Screen name={AccountRoutes.PRIVACY} component={PrivacyScreen} />
      <Stack.Screen name={AccountRoutes.TERMS} component={TermsScreen} />
      <Stack.Screen
        name={AccountRoutes.HELP_SUPPORT}
        component={HelpSupportScreen}
      />
      <Stack.Screen
        name={AccountRoutes.ACHIEVEMENTS}
        component={AchievementsScreen}
      />
      <Stack.Screen
        name={AccountRoutes.REFERRAL}
        component={ReferralScreen}
      />
    </Stack.Navigator>
  );
};

export default AccountNavigator;
