import React, { useMemo } from 'react';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { TabRoutes } from './routes';
import type { TabParamList } from '../types/navigation.types';

// ─── Health Screens ───────────────────────────────────────────────────────────
import TrackerScreen from '../features/health/screens/TrackerScreen';
// ─── Shop Screens ─────────────────────────────────────────────────────────────
import ShopScreen from '../features/shop/screens/ShopScreen';
import { useTheme } from '../hooks/useTheme';
import { Platform, ViewStyle } from 'react-native';
import { withOpacity } from '../utils/withOpacity';
import { SCREEN_WIDTH } from '../utils/measure';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AccountScreen from '../features/account/screens/AccountScreen';
import { Icon } from '../components';

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator: React.FC = () => {
  const { bottom } = useSafeAreaInsets();
  const { colors, radius } = useTheme();

  const tabBarStyle = useMemo(() => {
    const style: ViewStyle = {
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
    };

    return style;
  }, [bottom, colors.background, radius.full]);

  const screenOptions = useMemo<BottomTabNavigationOptions>(
    () => ({
      tabBarStyle,
      tabBarHideOnKeyboard: true,
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.foreground,
      animation: 'shift',
      lazy: true,
      tabBarAllowFontScaling: true,
    }),
    [tabBarStyle, colors.primary, colors.ring],
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
