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
  [HealthRoutes.EDIT_STEPS_GOAL]: undefined;
  [HealthRoutes.ANALYTICS]: undefined;
  [HealthRoutes.STREAK]: undefined;
  [HealthRoutes.COINS]: undefined;
  // Nutrition Phase 2
  [HealthRoutes.FOOD_CATALOG]: { mealType?: string } | undefined;
  [HealthRoutes.FOOD_DETAIL]: { foodId: string };
  // BMI
  [HealthRoutes.BMI_CALCULATOR]: undefined;
  // Leaderboard
  [HealthRoutes.LEADERBOARD]: undefined;
  // Challenges
  [HealthRoutes.CHALLENGES]: undefined;
  [HealthRoutes.CHALLENGE_DETAIL]: { challengeId: string };
};

// ─── Shop Stack ───────────────────────────────────────────────────────────────

export type ShopStackParamList = {
  [ShopRoutes.SHOP]: undefined;
  [ShopRoutes.SHOP_SEARCH]: undefined;
  [ShopRoutes.PRODUCT_DETAIL]: { productId: string };
  [ShopRoutes.CART]: { preSelectCoins?: boolean } | undefined;
  [ShopRoutes.CHECKOUT]: undefined;
  [ShopRoutes.ORDER_HISTORY]: undefined;
  [ShopRoutes.ADDRESSES]: { selectMode?: boolean } | undefined;
  [ShopRoutes.ADD_EDIT_ADDRESS]: { addressId?: string } | undefined;
};

// ─── Account Stack ────────────────────────────────────────────────────────────

export type AccountStackParamList = {
  [AccountRoutes.ACCOUNT]: undefined;
  [AccountRoutes.SETTINGS]: undefined;
  [AccountRoutes.EDIT_PROFILE]: undefined;
  [AccountRoutes.NOTIFICATIONS]: undefined;
  [AccountRoutes.PRIVACY]: undefined;
  [AccountRoutes.TERMS]: undefined;
  [AccountRoutes.HELP_SUPPORT]: undefined;
  [AccountRoutes.ACHIEVEMENTS]: undefined;
  [AccountRoutes.REFERRAL]: undefined;
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
  [RootRoutes.ACCOUNT_NAVIGATOR]: NavigatorScreenParams<AccountStackParamList>;
  [RootRoutes.SHOP_NAVIGATOR]: NavigatorScreenParams<ShopStackParamList>;

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
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
