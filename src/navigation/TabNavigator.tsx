import React, { useMemo, lazy, Suspense } from 'react';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { ActivityIndicator, Platform, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabRoutes } from './routes';
import type { TabParamList } from '../types/navigation.types';
import TrackerScreen from '../features/health/screens/TrackerScreen';
import { useTheme } from '../hooks/useTheme';
import { withOpacity } from '../utils/withOpacity';
import { SCREEN_WIDTH } from '../utils/measure';
import { Icon } from '../components';

// Lazy-load non-initial tab screens to reduce startup bundle parse time
const ShopScreen = lazy(() => import('../features/shop/screens/ShopScreen'));
const AccountScreen = lazy(() => import('../features/account/screens/AccountScreen'));

const Tab = createBottomTabNavigator<TabParamList>();

const LazyFallback: React.FC = () => {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
};

const LazyShopScreen = () => (
  <Suspense fallback={<LazyFallback />}>
    <ShopScreen />
  </Suspense>
);

const LazyAccountScreen = () => (
  <Suspense fallback={<LazyFallback />}>
    <AccountScreen />
  </Suspense>
);

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
      lazy: true,
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
        component={LazyShopScreen}
        options={{
          tabBarLabel: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Icon name="ShoppingBag" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name={TabRoutes.ACCOUNT}
        component={LazyAccountScreen}
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
