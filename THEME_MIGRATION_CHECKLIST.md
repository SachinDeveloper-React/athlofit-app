# Theme Migration Checklist

Use this checklist to track progress on migrating all components to the theme system.

## ✅ Core Theme Files

- [x] `src/constants/colors.ts` - Extended with all needed colors
- [x] `src/constants/spacing.ts` - Added missing spacing values
- [x] `src/constants/typography.ts` - Already complete
- [x] `src/hooks/useTheme.ts` - Already complete
- [x] `src/hooks/makeStyles.ts` - Already complete

## ✅ Core Components (src/components/)

- [x] `Avatar.tsx` - Fully migrated
- [x] `Toast.tsx` - Fully migrated
- [x] `AppModal.tsx` - Already using theme
- [x] `BottomSheet.tsx` - Already using theme
- [ ] `AppText.tsx` - Review needed
- [ ] `AppView.tsx` - Review needed
- [ ] `Badge.tsx` - Review needed
- [ ] `Button.tsx` - Review needed
- [ ] `Card.tsx` - Review needed
- [ ] `Chip.tsx` - Review needed
- [ ] `CoinBadge.tsx` - Review needed
- [ ] `Divider.tsx` - Review needed
- [ ] `Header.tsx` - Review needed
- [ ] `Icon.tsx` - Review needed
- [ ] `IconButton.tsx` - Review needed
- [ ] `Input.tsx` - Review needed
- [ ] `Loader.tsx` - Review needed
- [ ] `ProgressBar.tsx` - Review needed
- [ ] `Screen.tsx` - Review needed
- [ ] `SkeletonLoader.tsx` - Review needed
- [ ] `Tabs.tsx` - Review needed
- [ ] `Typography.tsx` - Review needed
- [ ] `common/SystemOverlay.tsx` - Has hardcoded #fff

## 🔴 Account Feature (src/features/account/)

### Components
- [x] `components/accounts/useAccountStyles.tsx` - Fully migrated
- [x] `components/notification/NotificationRow.tsx` - Fully migrated
- [ ] `components/AvatarCard.tsx`
- [ ] `components/AvatarPickerModal.tsx` - HIGH PRIORITY (8+ hardcoded values)
- [ ] `components/ProfileStats.tsx`
- [ ] `components/SettingRow.tsx`
- [ ] `components/accounts/AccountAvatar.tsx`
- [ ] `components/accounts/AccountIconPill.tsx`
- [ ] `components/accounts/AccountProfileHeader.tsx`
- [ ] `components/accounts/AccountProgressBar.tsx`
- [ ] `components/accounts/AccountSettingRow.tsx`
- [ ] `components/accounts/AccountStatPill.tsx` - Has hardcoded gold colors
- [ ] `components/accounts/AccountTierCard.tsx`
- [ ] `components/complete-profile/DateField.tsx` - HIGH PRIORITY (10+ hardcoded values)
- [ ] `components/complete-profile/Field.tsx` - Has hardcoded success green
- [ ] `components/complete-profile/NumericStepper.tsx`
- [ ] `components/complete-profile/PickerSheet.tsx` - Has hardcoded backdrop/handle colors
- [ ] `components/complete-profile/Step1Personal.tsx`
- [ ] `components/complete-profile/Step2Body.tsx`
- [ ] `components/settings/SettingsRow.tsx`

### Screens
- [ ] `screens/AccountScreen.tsx`
- [ ] `screens/AchievementsScreen.tsx` - Has hardcoded gold rgba
- [ ] `screens/CompleteProfileScreen.tsx`
- [ ] `screens/EditProfileScreen.tsx` - HIGH PRIORITY (4+ hardcoded values)
- [ ] `screens/HelpSupportScreen.tsx` - Has hardcoded shadows
- [ ] `screens/NotificationsScreen.tsx`
- [ ] `screens/PrivacyScreen.tsx` - HIGH PRIORITY (5+ hardcoded values)
- [ ] `screens/ProfileScreen.tsx`
- [ ] `screens/ReferralScreen.tsx` - HIGH PRIORITY (6+ inline hardcoded colors)
- [ ] `screens/SettingsScreen.tsx`
- [ ] `screens/TermsScreen.tsx` - HIGH PRIORITY (5+ hardcoded values)

## 🔴 Auth Feature (src/features/auth/)

### Components
- [x] `components/onboarding/OnbaordingSubComponents.tsx` - Fully migrated
- [ ] `components/AuthHeader.tsx`
- [ ] `components/OtpInput.tsx`
- [ ] `components/SocialLoginButtons.tsx`
- [ ] `components/onboarding/GoalScene.tsx`
- [ ] `components/onboarding/HeartScene.tsx`
- [ ] `components/onboarding/NutritionScene.tsx`
- [ ] `components/onboarding/RunnerScene.tsx`
- [ ] `components/onboarding/SleepScene.tsx`

### Screens
- [ ] `screens/ForgotPasswordScreen.tsx`
- [ ] `screens/LoginScreen.tsx`
- [ ] `screens/OnboardingScreen.tsx`
- [ ] `screens/OtpScreen.tsx`
- [ ] `screens/ResetPasswordScreen.tsx`
- [ ] `screens/SignupScreen.tsx` - Uses makeStyles (check if complete)
- [ ] `screens/SplashScreen.tsx`

## 🔴 Health Feature (src/features/health/)

### Components - Analytics
- [ ] `components/analytics/ChartSection.tsx`
- [ ] `components/analytics/GoalsSection.tsx`
- [ ] `components/analytics/InsightCard.tsx`
- [ ] `components/analytics/MetricCard.tsx`
- [ ] `components/analytics/RingProgress.tsx`
- [ ] `components/analytics/SummaryRow.tsx`
- [ ] `components/analytics/TrendBadge.tsx`

### Components - Blood Pressure
- [ ] `components/blood-pressure/BPCategoryChart.tsx`
- [ ] `components/blood-pressure/DeviceCard.tsx`
- [ ] `components/blood-pressure/DevicePickerModal.tsx`
- [ ] `components/blood-pressure/LatestReadingCard.tsx`
- [ ] `components/blood-pressure/ManualEntryCard.tsx`
- [ ] `components/blood-pressure/ModeToggle.tsx`
- [ ] `components/blood-pressure/PulseRing.tsx`
- [ ] `components/blood-pressure/ReadingHistory.tsx`

### Components - BMI
- [ ] `components/bmi/BmiHistoryChart.tsx`
- [ ] `components/bmi/BmiHistoryList.tsx`
- [ ] `components/bmi/GaugeSection.tsx`

### Components - Challenges
- [ ] `components/challenges/ChallengeCard.tsx`

### Components - Coins
- [ ] `components/coins/ClaimableItem.tsx`
- [ ] `components/coins/TransactionItem.tsx` - Uses makeStyles (check if complete)

### Components - Edit Steps Goal
- [ ] `components/edit-steps-goal/BackButton.tsx`
- [ ] `components/edit-steps-goal/PresetSelector.tsx`
- [ ] `components/edit-steps-goal/SaveButton.tsx`
- [ ] `components/edit-steps-goal/StatsRow.tsx`
- [ ] `components/edit-steps-goal/StepCounter.tsx`
- [ ] `components/edit-steps-goal/StepsSlider.tsx`

### Components - Heart Rate
- [ ] `components/heart-rate/HeartRateResultCard.tsx`
- [ ] `components/heart-rate/InstructionCard.tsx`
- [ ] `components/heart-rate/ManualEntryModal.tsx`
- [ ] `components/heart-rate/ProgressRing.tsx`
- [ ] `components/heart-rate/PulseIndicator.tsx`
- [ ] `components/heart-rate/SavedBanner.tsx`

### Components - Hydration
- [ ] `components/hydration/AmountDisplay.tsx`
- [ ] `components/hydration/HistoryList.tsx`
- [ ] `components/hydration/QuickAddButtons.tsx`
- [ ] `components/hydration/ScheduleModal.tsx`
- [ ] `components/hydration/StatsCard.tsx`
- [ ] `components/hydration/WaterGlass.tsx`

### Components - Leaderboard
- [ ] `components/leaderboard/Avatar.tsx`
- [ ] `components/leaderboard/Podium.tsx`
- [ ] `components/leaderboard/RankRow.tsx`

### Components - Nutrition
- [ ] `components/nutrition/CalorieSummaryCard.tsx`
- [ ] `components/nutrition/ChallengeNutritionCard.tsx`
- [ ] `components/nutrition/DietPreferenceChips.tsx`
- [ ] `components/nutrition/DietRecommendationCard.tsx`
- [ ] `components/nutrition/FilterPill.tsx`
- [ ] `components/nutrition/FoodCard.tsx`
- [ ] `components/nutrition/FoodCatalog.tsx`
- [ ] `components/nutrition/MacroRow.tsx`
- [ ] `components/nutrition/MealLogBottomSheet.tsx`
- [ ] `components/nutrition/MealPicker.tsx`
- [ ] `components/nutrition/MealSection.tsx`

### Components - Streaks
- [ ] `components/streaks/BadgeCard.tsx`
- [ ] `components/streaks/BadgeItem.tsx`
- [ ] `components/streaks/StreakRing.tsx`

### Components - Tracker
- [ ] `components/tracker/ChallengeTrackerCard.tsx`
- [ ] `components/tracker/DailyStatsSection.tsx`
- [ ] `components/tracker/HealthGate.tsx`
- [ ] `components/tracker/HydrationCard.tsx`
- [ ] `components/tracker/NutritionAndGoalSection.tsx`
- [ ] `components/tracker/RightTrackerHeader.tsx`
- [ ] `components/tracker/StepProgressCard.tsx`
- [ ] `components/tracker/TrackerMotivation.tsx`
- [ ] `components/tracker/TrackerStreaksBadges.tsx`
- [ ] `components/tracker/WaterCircleProgress.tsx`

### Components - Other
- [ ] `components/ActivityRings.tsx`
- [ ] `components/HealthMetricCard.tsx`
- [ ] `components/MetricCard.tsx`
- [ ] `components/TimeframeTabs.tsx`

### Screens
- [ ] `screens/BloodPressureScreen.tsx`
- [ ] `screens/BmiCalculatorScreen.tsx`
- [ ] `screens/CaloriesScreen.tsx`
- [ ] `screens/ChallengeDetailScreen.tsx`
- [ ] `screens/ChallengesScreen.tsx`
- [ ] `screens/CoinScreen.tsx`
- [ ] `screens/EditStepsGoalScreen.tsx`
- [ ] `screens/FoodCatalogScreen.tsx` - Uses makeStyles (check if complete)
- [ ] `screens/FoodDetailScreen.tsx`
- [ ] `screens/HealthAnalyticsScreen.tsx`
- [ ] `screens/HeartRateScreen.tsx`
- [ ] `screens/HydrationScreen.tsx`
- [ ] `screens/LeaderboardScreen.tsx`
- [ ] `screens/StepsScreen.tsx`
- [ ] `screens/StreakScreen.tsx`
- [ ] `screens/TrackerScreen.tsx`

## 🔴 Shop Feature (src/features/shop/)

### Components
- [ ] `components/CartItem.tsx`
- [ ] `components/CategoryPill.tsx`
- [ ] `components/FeaturedCard.tsx`
- [ ] `components/PriceTag.tsx`
- [ ] `components/ProductCard.tsx`
- [ ] `components/ReviewSection.tsx`

### Screens
- [ ] `screens/AddEditAddressScreen.tsx`
- [ ] `screens/AddressesScreen.tsx`
- [ ] `screens/CartScreen.tsx`
- [ ] `screens/CheckoutScreen.tsx`
- [ ] `screens/OrderHistoryScreen.tsx`
- [ ] `screens/ProductDetailScreen.tsx`
- [ ] `screens/ShopScreen.tsx`
- [ ] `screens/ShopSearchScreen.tsx`

### Context
- [ ] `context/CartContext.tsx`

## 📱 Navigation (src/navigation/)

- [ ] `AccountNavigator.tsx`
- [ ] `AuthNavigator.tsx`
- [ ] `HealthNavigator.tsx`
- [ ] `ProfileSetupNavigator.tsx`
- [ ] `RootNavigator.tsx`
- [ ] `ShopNavigator.tsx`
- [ ] `TabNavigator.tsx`

## 📊 Progress Summary

### Overall Progress
- **Total Files**: ~180
- **Completed**: 7
- **Remaining**: ~173
- **Progress**: ~4%

### By Priority
- **High Priority**: 10 files identified
- **Medium Priority**: ~100 files
- **Low Priority**: ~70 files

### By Feature
- **Core Components**: 4/23 (17%)
- **Account Feature**: 2/32 (6%)
- **Auth Feature**: 1/13 (8%)
- **Health Feature**: 0/90 (0%)
- **Shop Feature**: 0/15 (0%)
- **Navigation**: 0/7 (0%)

## 🎯 Next Actions

1. **Immediate** (Next 2-3 hours):
   - [ ] Complete high-priority account files
   - [ ] Complete remaining core components
   - [ ] Test in both light and dark modes

2. **Short-term** (Next 1-2 days):
   - [ ] Complete all auth feature files
   - [ ] Complete account feature files
   - [ ] Start on shop feature

3. **Medium-term** (Next 3-5 days):
   - [ ] Complete health feature components
   - [ ] Complete health feature screens
   - [ ] Update navigation files

4. **Final** (Last day):
   - [ ] Run find-hardcoded-values.sh
   - [ ] Fix any remaining hardcoded values
   - [ ] Full app testing in light/dark modes
   - [ ] Update documentation

## 📝 Notes

- Use `scripts/find-hardcoded-values.sh` to find remaining hardcoded values
- Refer to `THEME_COMPONENT_TEMPLATE.tsx` for examples
- Refer to `THEME_MIGRATION_GUIDE.md` for detailed instructions
- Test each component in both light and dark modes after migration
- Run `getDiagnostics` to check for TypeScript errors

## ✨ Success Criteria

- [ ] No hardcoded hex colors in any file
- [ ] No hardcoded rgba/rgb values
- [ ] No hardcoded numeric spacing
- [ ] No hardcoded font sizes
- [ ] No hardcoded font weights
- [ ] No hardcoded border radius
- [ ] No hardcoded shadows
- [ ] All components work in light mode
- [ ] All components work in dark mode
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] App passes visual QA in both modes
