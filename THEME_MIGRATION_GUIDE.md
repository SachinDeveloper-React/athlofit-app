# Theme Migration Guide

## Overview
This project now has a comprehensive theme system that eliminates all hardcoded values for colors, spacing, radius, fontSize, fontWeight, shadows, and dark mode support.

## Theme System Structure

### 1. Theme Hook (`src/hooks/useTheme.ts`)
```typescript
const { colors, spacing, radius, shadow, fontSize, fontWeight, isDark } = useTheme();
```

### 2. Available Theme Properties

#### Colors (`colors`)
- **Base colors**: `background`, `foreground`, `card`, `cardForeground`
- **UI colors**: `primary`, `secondary`, `muted`, `accent`, `destructive`
- **Input colors**: `input`, `inputBackground`, `switchBackground`
- **Semantic colors**: `success`, `warning`, `gold`, `link`
- **Notification colors**: `notificationChallenge`, `notificationCoin`, `notificationProduct`
- **Avatar colors**: `avatarPrimary`, `avatarPurple`, `avatarGreen`, `avatarOrange`, `avatarRed`, `avatarPink`, `avatarIndigo`, `avatarCyan`
- **Tier colors**: `tierBackground`, `tierForeground`, `tierProgress`
- **Overlay colors**: `overlayLight`, `overlayMedium`, `overlayHeavy`
- **Chart colors**: `chart.c1` through `chart.c5`
- **Gradients**: `gradient.primary`, `gradient.secondary`

#### Spacing (`spacing`)
- Values: `0`, `0.5`, `1`, `1.25`, `1.5`, `2`, `2.5`, `3`, `4`, `5`, `6`, `7`, `8`, `10`, `12`, `14`, `15`, `16`, `18`, `20`
- Usage: `spacing[4]` = 16px, `spacing[2]` = 8px

#### Radius (`radius`)
- Values: `none`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, `3xl`, `full`
- Usage: `radius.lg` = 12px, `radius.full` = 9999px

#### Shadow (`shadow`)
- Values: `none`, `shadow1`, `xs`, `sm`, `md`, `lg`, `xl`
- Usage: Spread shadow object: `...shadow.md`

#### Font Size (`fontSize`)
- Values: `xs`, `sm`, `md`, `base`, `lg`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`
- Usage: `fontSize.base` = 16px, `fontSize['2xl']` = 22px

#### Font Weight (`fontWeight`)
- Values: `regular`, `medium`, `semiBold`, `bold`
- Usage: `fontWeight.bold` = '700'

#### Dark Mode (`isDark`)
- Boolean flag: `true` when dark mode is active

## Migration Patterns

### ❌ Before (Hardcoded)
```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
  },
});
```

### ✅ After (Theme-based)
```typescript
const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight, shadow }) => ({
  container: {
    backgroundColor: colors.background,
    padding: spacing[4],
    borderRadius: radius.lg,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    ...shadow.sm,
  },
}));

// In component:
const styles = useStyles();
```

### Alternative Pattern (Direct useTheme)
```typescript
const MyComponent = () => {
  const { colors, spacing, radius } = useTheme();
  
  return (
    <View style={{
      backgroundColor: colors.card,
      padding: spacing[4],
      borderRadius: radius.xl,
    }}>
      {/* content */}
    </View>
  );
};
```

## Common Replacements

### Colors
- `#FFFFFF` → `colors.background` or `colors.primaryForeground`
- `#000000` → `colors.foreground`
- `#0099FF` → `colors.primary`
- `#8B5CF6` → `colors.notificationChallenge`
- `#F5C518` → `colors.notificationCoin`
- `#10B981` → `colors.notificationProduct` or `colors.avatarGreen`
- `rgba(255,255,255,0.06)` → `colors.overlayLight`
- `rgba(255,255,255,0.1)` → `colors.overlayMedium`
- `rgba(255,255,255,0.2)` → `colors.overlayHeavy`

### Spacing
- `4` → `spacing[1]`
- `8` → `spacing[2]`
- `12` → `spacing[3]`
- `16` → `spacing[4]`
- `20` → `spacing[5]`
- `24` → `spacing[6]`
- `32` → `spacing[8]`

### Border Radius
- `4` → `radius.xs`
- `8` → `radius.md`
- `12` → `radius.lg`
- `16` → `radius.xl`
- `20` → `radius['2xl']`
- `24` → `radius['3xl']`
- `999` or `9999` → `radius.full`

### Font Sizes
- `11` → `fontSize.xs`
- `12` → `fontSize.sm`
- `14` → `fontSize.md`
- `16` → `fontSize.base`
- `20` → `fontSize.xl`
- `22` → `fontSize['2xl']`
- `28` → `fontSize['4xl']`
- `34` → `fontSize['5xl']`

### Font Weights
- `'400'` → `fontWeight.regular`
- `'500'` → `fontWeight.medium`
- `'600'` → `fontWeight.semiBold`
- `'700'` or `'900'` → `fontWeight.bold`

## Files Already Updated

### ✅ Core Theme Files
- `src/constants/colors.ts` - Extended with notification, avatar, tier, and overlay colors
- `src/constants/spacing.ts` - Added missing spacing values (1.25, 14, 15, 18) and shadow1
- `src/hooks/useTheme.ts` - Already properly structured

### ✅ Components Updated
- `src/components/Avatar.tsx` - Using theme avatar colors
- `src/components/Toast.tsx` - Using theme colors for text and backgrounds
- `src/components/AppModal.tsx` - Already using theme
- `src/components/BottomSheet.tsx` - Already using theme

### ✅ Feature Components Updated
- `src/features/account/components/accounts/useAccountStyles.tsx` - Fully migrated to theme tokens
- `src/features/account/components/notification/NotificationRow.tsx` - Using theme notification colors

## Files Still Needing Updates

### 🔴 High Priority
1. `src/features/auth/components/onboarding/OnbaordingSubComponents.tsx` - 12+ hardcoded rgba values
2. `src/features/account/components/complete-profile/DateField.tsx` - 10+ hardcoded values
3. `src/features/account/screens/ReferralScreen.tsx` - 6+ inline hardcoded colors
4. `src/features/account/components/AvatarPickerModal.tsx` - 8+ hardcoded spacing/radius
5. `src/features/account/screens/EditProfileScreen.tsx` - 4+ hardcoded colors/sizes
6. `src/features/account/screens/TermsScreen.tsx` - 5+ hardcoded shadow/spacing
7. `src/features/account/screens/PrivacyScreen.tsx` - 5+ hardcoded shadow/spacing
8. `src/features/account/screens/AchievementsScreen.tsx` - 2+ hardcoded colors
9. `src/features/account/components/complete-profile/PickerSheet.tsx` - Backdrop and handle colors
10. `src/features/account/components/complete-profile/Field.tsx` - Success green color

### 🟡 Medium Priority
- All remaining screens in `src/features/*/screens/`
- All remaining components in `src/features/*/components/`

## Best Practices

1. **Always use `makeStyles` hook for complex components**
   ```typescript
   const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
     // styles here
   }));
   ```

2. **Use `withOpacity` utility for transparent colors**
   ```typescript
   backgroundColor: withOpacity(colors.foreground, 0.06)
   ```

3. **Never hardcode colors, spacing, or typography values**
   - All values should come from theme
   - Use theme tokens for consistency

4. **Test in both light and dark modes**
   - Toggle device appearance to verify
   - Ensure all colors adapt properly

5. **Use semantic color names**
   - `colors.primary` instead of specific hex
   - `colors.destructive` for error states
   - `colors.success` for success states

## Testing Checklist

- [ ] Component renders in light mode
- [ ] Component renders in dark mode
- [ ] No hardcoded color values remain
- [ ] No hardcoded spacing values remain
- [ ] No hardcoded font sizes remain
- [ ] No hardcoded border radius values remain
- [ ] Shadows use theme shadow tokens
- [ ] Component is visually consistent with design system

## Next Steps

1. Update high-priority files listed above
2. Run search for remaining hardcoded values:
   ```bash
   grep -r "#[0-9A-Fa-f]\{6\}" src/features --include="*.tsx"
   grep -r "rgba(" src/features --include="*.tsx"
   grep -r "fontSize: [0-9]" src/features --include="*.tsx"
   grep -r "fontWeight: '[0-9]" src/features --include="*.tsx"
   ```
3. Update navigation files if needed
4. Test entire app in both light and dark modes
5. Document any custom color additions needed

## Support

For questions or issues with theme migration, refer to:
- `src/hooks/useTheme.ts` - Theme hook implementation
- `src/constants/colors.ts` - Color definitions
- `src/constants/spacing.ts` - Spacing and shadow definitions
- `src/constants/typography.ts` - Typography definitions
