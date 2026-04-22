import React, { useMemo } from 'react';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { Platform, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabRoutes } from './routes';
import type { TabParamList } from '../types/navigation.types';
import TrackerScreen from '../features/health/screens/TrackerScreen';
import ShopScreen from '../features/shop/screens/ShopScreen';
import AccountScreen from '../features/account/screens/AccountScreen';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { SCREEN_WIDTH } from '../utils/measure';
import { Icon } from '../components';

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator: React.FC = () => {
  const { bottom } = useSafeAreaInsets();
  const { colors, radius } = useTheme();

  const tabBarStyle = useMemo<ViewStyle>(
    () => ({
      position: 'absolute',
      backgroundColor: withOpacity(colors.card, 0.8),
      borderTopColor: 'transparent',
      borderTopWidth: 0,
      height: 60,
      marginHorizontal: SCREEN_WIDTH * 0.1,
      marginBottom: Platform.OS === 'ios' ? bottom : bottom + 16,
      borderRadius: radius.full,
      paddingBottom: 8,
      paddingTop: 4,
      ...(Platform.OS === 'android'
        ? { elevation: 5 }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
          }),
    }),
    [bottom, colors.card, radius.full],
  );

  // direction: +1 = navigating right (e.g. Tracker→Shop), -1 = navigating left

  const screenOptions = useMemo<BottomTabNavigationOptions>(
    () => ({
      tabBarStyle,
      tabBarHideOnKeyboard: true,
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.foreground,
      lazy: false,
      tabBarAllowFontScaling: true,
      sceneContainerStyle: { backgroundColor: colors.background },
      // Use the built-in ShiftTransition — subtle slide + fade, no blank screen issues
      ...require('@react-navigation/bottom-tabs').ShiftTransition,
    }),
    [tabBarStyle, colors.primary, colors.foreground, colors.background],
  );

  return (
    <Tab.Navigator
      initialRouteName={TabRoutes.TRACKER}
      screenOptions={screenOptions}
    >
      <Tab.Screen
        name={TabRoutes.TRACKER}
        component={TrackerScreen}
        options={{
          tabBarLabel: 'Tracker',
          tabBarIcon: ({ color, size }) => (
            <Icon name="HeartPulse" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name={TabRoutes.SHOP}
        component={ShopScreen}
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Icon name="ShoppingBag" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name={TabRoutes.ACCOUNT}
        component={AccountScreen}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Icon name="PersonStanding" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
