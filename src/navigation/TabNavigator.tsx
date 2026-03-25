import React, { useMemo } from 'react';
import {
  BottomTabNavigationOptions,
  createBottomTabNavigator,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabRoutes, HealthRoutes, ShopRoutes, AccountRoutes } from './routes';
import type {
  TabParamList,
  HealthStackParamList,
  ShopStackParamList,
  AccountStackParamList,
} from '../types/navigation.types';

// ─── Health Screens ───────────────────────────────────────────────────────────
import TrackerScreen from '../features/health/screens/TrackerScreen';
import StepsScreen from '../features/health/screens/StepsScreen';
import CaloriesScreen from '../features/health/screens/CaloriesScreen';
import HeartRateScreen from '../features/health/screens/HeartRateScreen';
import BloodPressureScreen from '../features/health/screens/BloodPressureScreen';
import HealthAnalyticsScreen from '../features/health/screens/HealthAnalyticsScreen';
import StreakScreen from '../features/health/screens/StreakScreen';

// ─── Shop Screens ─────────────────────────────────────────────────────────────
import ShopScreen from '../features/shop/screens/ShopScreen';
import ProductDetailScreen from '../features/shop/screens/ProductDetailScreen';
import CartScreen from '../features/shop/screens/CartScreen';
import CheckoutScreen from '../features/shop/screens/CheckoutScreen';
import OrderHistoryScreen from '../features/shop/screens/OrderHistoryScreen';

// ─── Account Screens ──────────────────────────────────────────────────────────
import ProfileScreen from '../features/account/screens/ProfileScreen';
import SettingsScreen from '../features/account/screens/SettingsScreen';
import EditProfileScreen from '../features/account/screens/EditProfileScreen';
import NotificationsScreen from '../features/account/screens/NotificationsScreen';
import PrivacyScreen from '../features/account/screens/PrivacyScreen';
import { useTheme } from '../hooks/useTheme';
import { Platform, ViewStyle } from 'react-native';
import { withOpacity } from '../utils/withOpacity';
import { SCREEN_WIDTH } from '../utils/measure';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Stack Navigators ─────────────────────────────────────────────────────────

const HealthStack = createNativeStackNavigator<HealthStackParamList>();
const ShopStack = createNativeStackNavigator<ShopStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const sharedStackOptions = {
  headerShown: false,
  animation: 'slide_from_right' as const,
};

// ─── Health Stack Navigator ───────────────────────────────────────────────────

function HealthStackNavigator(): React.ReactElement {
  return (
    <HealthStack.Navigator
      initialRouteName={HealthRoutes.TRACKER}
      screenOptions={sharedStackOptions}
    >
      <HealthStack.Screen
        name={HealthRoutes.TRACKER}
        component={TrackerScreen}
      />
      <HealthStack.Screen name={HealthRoutes.STEPS} component={StepsScreen} />
      <HealthStack.Screen
        name={HealthRoutes.CALORIES}
        component={CaloriesScreen}
      />
      <HealthStack.Screen
        name={HealthRoutes.HEART_RATE}
        component={HeartRateScreen}
      />
      <HealthStack.Screen
        name={HealthRoutes.BLOOD_PRESSURE}
        component={BloodPressureScreen}
      />
      <HealthStack.Screen
        name={HealthRoutes.ANALYTICS}
        component={HealthAnalyticsScreen}
      />
      <HealthStack.Screen name={HealthRoutes.STREAK} component={StreakScreen} />
    </HealthStack.Navigator>
  );
}

// ─── Shop Stack Navigator ─────────────────────────────────────────────────────

function ShopStackNavigator(): React.ReactElement {
  return (
    <ShopStack.Navigator
      initialRouteName={ShopRoutes.SHOP}
      screenOptions={sharedStackOptions}
    >
      <ShopStack.Screen name={ShopRoutes.SHOP} component={ShopScreen} />
      <ShopStack.Screen
        name={ShopRoutes.PRODUCT_DETAIL}
        component={ProductDetailScreen}
      />
      <ShopStack.Screen name={ShopRoutes.CART} component={CartScreen} />
      <ShopStack.Screen name={ShopRoutes.CHECKOUT} component={CheckoutScreen} />
      <ShopStack.Screen
        name={ShopRoutes.ORDER_HISTORY}
        component={OrderHistoryScreen}
      />
    </ShopStack.Navigator>
  );
}

// ─── Account Stack Navigator ──────────────────────────────────────────────────

function AccountStackNavigator(): React.ReactElement {
  return (
    <AccountStack.Navigator
      initialRouteName={AccountRoutes.PROFILE}
      screenOptions={sharedStackOptions}
    >
      <AccountStack.Screen
        name={AccountRoutes.PROFILE}
        component={ProfileScreen}
      />
      <AccountStack.Screen
        name={AccountRoutes.SETTINGS}
        component={SettingsScreen}
      />
      <AccountStack.Screen
        name={AccountRoutes.EDIT_PROFILE}
        component={EditProfileScreen}
      />
      <AccountStack.Screen
        name={AccountRoutes.NOTIFICATIONS}
        component={NotificationsScreen}
      />
      <AccountStack.Screen
        name={AccountRoutes.PRIVACY}
        component={PrivacyScreen}
      />
    </AccountStack.Navigator>
  );
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

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
        component={HealthStackNavigator}
        options={{
          tabBarLabel: 'Tracker',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="heart-pulse" color={color} size={size} />
          // ),
        }}
      />
      <Tab.Screen
        name={TabRoutes.SHOP}
        component={ShopStackNavigator}
        options={{
          tabBarLabel: 'Shop',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="shopping-bag" color={color} size={size} />
          // ),
        }}
      />
      <Tab.Screen
        name={TabRoutes.ACCOUNT}
        component={AccountStackNavigator}
        options={{
          tabBarLabel: 'Account',
          // tabBarIcon: ({ color, size }) => (
          //   <Icon name="person" color={color} size={size} />
          // ),
        }}
      />
    </Tab.Navigator>
  );
};

export default TabNavigator;
