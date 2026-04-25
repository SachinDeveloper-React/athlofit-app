export const AuthRoutes = {
  ONBOARDING: 'Onboarding',
  LOGIN: 'Login',
  SIGNUP: 'Signup',
  FORGOT_PASSWORD: 'ForgotPassword',
  OTP: 'Otp',
  RESET_PASSWORD: 'ResetPassword',
} as const;

export const ProfileSetupRoutes = {
  COMPLETE_PROFILE: 'CompleteProfile',
} as const;

export const TabRoutes = {
  TRACKER: 'Tracker',
  SHOP: 'Shop',
  ACCOUNT: 'Account',
} as const;

export const HealthRoutes = {
  TRACKER: 'TrackerScreen',
  STEPS: 'StepsScreen',
  CALORIES: 'CaloriesScreen',
  HEART_RATE: 'HeartRateScreen',
  BLOOD_PRESSURE: 'BloodPressureScreen',
  HYDRATION: 'HydrationScreen',
  EDIT_STEPS_GOAL: 'EditStepsGoalScreen',
  ANALYTICS: 'HealthAnalyticsScreen',
  STREAK: 'StreakScreen',
  HEALTH_ANALYTICS: 'HealthAnalyticsScreen',
  COINS: 'CoinsScreen',
  // Nutrition Phase 2
  FOOD_CATALOG: 'FoodCatalogScreen',
  FOOD_DETAIL: 'FoodDetailScreen',
  // BMI
  BMI_CALCULATOR: 'BmiCalculatorScreen',
  // Leaderboard
  LEADERBOARD: 'LeaderboardScreen',
  CHALLENGES: 'ChallengesScreen',
  CHALLENGE_DETAIL: 'ChallengeDetailScreen',
} as const;

export const ShopRoutes = {
  SHOP: 'ShopScreen',
  SHOP_SEARCH: 'ShopSearchScreen',
  PRODUCT_DETAIL: 'ProductDetailScreen',
  CART: 'CartScreen',
  CHECKOUT: 'CheckoutScreen',
  ORDER_HISTORY: 'OrderHistoryScreen',
  ADDRESSES: 'AddressesScreen',
  ADD_EDIT_ADDRESS: 'AddEditAddressScreen',
} as const;

export const AccountRoutes = {
  ACCOUNT: 'AccountScreen',
  SETTINGS: 'SettingsScreen',
  EDIT_PROFILE: 'EditProfileScreen',
  NOTIFICATIONS: 'NotificationsScreen',
  PRIVACY: 'PrivacyScreen',
  TERMS: 'TermsScreen',
  HELP_SUPPORT: 'HelpSupportScreen',
  ACHIEVEMENTS: 'AchievementsScreen',
  REFERRAL: 'ReferralScreen',
} as const;

export const RootRoutes = {
  AUTH_STACK: 'AuthStack',
  PROFILE_SETUP_STACK: 'ProfileSetupStack',
  TAB_NAVIGATOR: 'TabNavigator',
  HEALTH_NAVIGATOR: 'HealthStack',
  ACCOUNT_NAVIGATOR: 'AccountStack',
  SHOP_NAVIGATOR: 'ShopStack',
} as const;
