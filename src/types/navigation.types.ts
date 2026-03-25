import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import {
  AuthRoutes,
  TabRoutes,
  HealthRoutes,
  ShopRoutes,
  AccountRoutes,
  RootRoutes,
  ProfileSetupRoutes,
} from '../navigation/routes';

// ─── Auth Stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  [AuthRoutes.ONBOARDING]: undefined;
  [AuthRoutes.LOGIN]: undefined;
  [AuthRoutes.SIGNUP]: undefined;
  [AuthRoutes.FORGOT_PASSWORD]: undefined;
  [AuthRoutes.OTP]: { email: string; flow: 'forgot_password' | 'signup' };
  [AuthRoutes.RESET_PASSWORD]: { email: string; otp: string };
};

// ─── Profile Setup Stack ──────────────────────────────────────────────────────

export type ProfileSetupStackParamList = {
  [ProfileSetupRoutes.COMPLETE_PROFILE]: undefined;
};

// ─── Health Stack ─────────────────────────────────────────────────────────────

export type HealthStackParamList = {
  [HealthRoutes.TRACKER]: undefined;
  [HealthRoutes.STEPS]: undefined;
  [HealthRoutes.CALORIES]: undefined;
  [HealthRoutes.HEART_RATE]: undefined;
  [HealthRoutes.BLOOD_PRESSURE]: undefined;
  [HealthRoutes.HYDRATION]: undefined;
  [HealthRoutes.ANALYTICS]: {
    metric: 'steps' | 'calories' | 'heartRate' | 'bloodPressure';
  };
  [HealthRoutes.STREAK]: undefined;
};

// ─── Shop Stack ───────────────────────────────────────────────────────────────

export type ShopStackParamList = {
  [ShopRoutes.SHOP]: undefined;
  [ShopRoutes.PRODUCT_DETAIL]: { productId: string };
  [ShopRoutes.CART]: undefined;
  [ShopRoutes.CHECKOUT]: undefined;
  [ShopRoutes.ORDER_HISTORY]: undefined;
};

// ─── Account Stack ────────────────────────────────────────────────────────────

export type AccountStackParamList = {
  [AccountRoutes.PROFILE]: undefined;
  [AccountRoutes.SETTINGS]: undefined;
  [AccountRoutes.EDIT_PROFILE]: undefined;
  [AccountRoutes.NOTIFICATIONS]: undefined;
  [AccountRoutes.PRIVACY]: undefined;
};

// ─── Tab Navigator ────────────────────────────────────────────────────────────

export type TabParamList = {
  [TabRoutes.TRACKER]: NavigatorScreenParams<HealthStackParamList>;
  [TabRoutes.SHOP]: NavigatorScreenParams<ShopStackParamList>;
  [TabRoutes.ACCOUNT]: NavigatorScreenParams<AccountStackParamList>;
};

// ─── Root Navigator ───────────────────────────────────────────────────────────

export type RootStackParamList = {
  [RootRoutes.AUTH_STACK]: NavigatorScreenParams<AuthStackParamList>;
  [RootRoutes.PROFILE_SETUP_STACK]: NavigatorScreenParams<ProfileSetupStackParamList>;
  [RootRoutes.TAB_NAVIGATOR]: NavigatorScreenParams<TabParamList>;
  [RootRoutes.HEALTH_NAVIGATOR]: NavigatorScreenParams<HealthStackParamList>;
};

// ─── Screen Props Helpers ─────────────────────────────────────────────────────

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>;

export type AuthStackScreenProps<T extends keyof AuthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AuthStackParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

export type HealthStackScreenProps<T extends keyof HealthStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<HealthStackParamList, T>,
    TabScreenProps<typeof TabRoutes.TRACKER>
  >;

export type ShopStackScreenProps<T extends keyof ShopStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<ShopStackParamList, T>,
    TabScreenProps<typeof TabRoutes.SHOP>
  >;

export type AccountStackScreenProps<T extends keyof AccountStackParamList> =
  CompositeScreenProps<
    NativeStackScreenProps<AccountStackParamList, T>,
    TabScreenProps<typeof TabRoutes.ACCOUNT>
  >;

export type ProfileSetupScreenProps<
  T extends keyof ProfileSetupStackParamList,
> = CompositeScreenProps<
  NativeStackScreenProps<ProfileSetupStackParamList, T>,
  RootStackScreenProps<keyof RootStackParamList>
>;

// ─── Typed useNavigation hook augmentation ────────────────────────────────────
// Add this to your root to get typed navigation globally:
// declare global {
//   namespace ReactNavigation {
//     interface RootParamList extends RootStackParamList {}
//   }
// }
