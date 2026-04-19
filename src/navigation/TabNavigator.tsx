import React, { useRef, useMemo } from 'react';
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

const TAB_ORDER = [TabRoutes.TRACKER, TabRoutes.SHOP, TabRoutes.ACCOUNT] as const;

function getTabIndex(name: string): number {
  return TAB_ORDER.indexOf(name as (typeof TAB_ORDER)[number]);
}

const Tab = createBottomTabNavigator<TabParamList>();

const TabNavigator: React.FC = () => {
  const { bottom } = useSafeAreaInsets();
  const { colors, radius } = useTheme();
  // Tracks the current active index so we know slide direction
  const activeIndexRef = useRef(0);

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
  const directionRef = useRef(1);

  const screenOptions = useMemo<BottomTabNavigationOptions>(
    () => ({
      tabBarStyle,
      tabBarHideOnKeyboard: true,
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.foreground,
      lazy: false,
      tabBarAllowFontScaling: true,
      transitionSpec: {
        animation: 'spring',
        config: {
          stiffness: 280,
          damping: 28,
          mass: 0.8,
          overshootClamping: true,
          restDisplacementThreshold: 0.01,
          restSpeedThreshold: 0.01,
        },
      },
      // interpolator only receives { current } — no route info
      // direction is pre-computed in screenListeners and stored in directionRef
      sceneStyleInterpolator: ({ current }) => {
        const SLIDE = SCREEN_WIDTH * 0.07 * directionRef.current;
        return {
          sceneStyle: {
            opacity: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [0, 1, 0],
            }),
            transform: [
              {
                translateX: current.progress.interpolate({
                  inputRange: [-1, 0, 1],
                  outputRange: [-SLIDE, 0, SLIDE],
                }),
              },
            ],
          },
        };
      },
    }),
    [tabBarStyle, colors.primary, colors.foreground],
  );

  return (
    <Tab.Navigator
      initialRouteName={TabRoutes.TRACKER}
      screenOptions={screenOptions}
      screenListeners={{
        tabPress: e => {
          const targetName = (e.target as string).split('-')[0];
          const nextIndex = getTabIndex(targetName);
          directionRef.current = nextIndex > activeIndexRef.current ? 1 : -1;
          activeIndexRef.current = nextIndex;
        },
      }}
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
