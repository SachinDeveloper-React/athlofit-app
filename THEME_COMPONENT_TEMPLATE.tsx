// THEME COMPONENT TEMPLATE
// Copy this template when creating new components to ensure theme compliance

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from './src/hooks/useTheme';
import { makeStyles } from './src/hooks/makeStyles';
import { withOpacity } from './src/utils/withOpacity';

// ═══════════════════════════════════════════════════════════════════════════
// OPTION 1: Simple Component (Direct useTheme)
// Use for components with few styles or dynamic styling
// ═══════════════════════════════════════════════════════════════════════════

export const SimpleComponent: React.FC<{ title: string }> = ({ title }) => {
  const { colors, spacing, radius, fontSize, fontWeight, shadow, isDark } = useTheme();

  return (
    <View
      style={{
        backgroundColor: colors.card,
        padding: spacing[4],
        borderRadius: radius.xl,
        marginBottom: spacing[3],
        ...shadow.md,
      }}
    >
      <Text
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.bold,
          color: colors.foreground,
          marginBottom: spacing[2],
        }}
      >
        {title}
      </Text>
      
      <Text
        style={{
          fontSize: fontSize.md,
          fontWeight: fontWeight.regular,
          color: colors.mutedForeground,
        }}
      >
        This is a simple component using direct theme access
      </Text>

      {/* Example: Conditional styling based on dark mode */}
      {isDark && (
        <View
          style={{
            marginTop: spacing[2],
            padding: spacing[2],
            backgroundColor: withOpacity(colors.primary, 0.1),
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: colors.primary, fontSize: fontSize.sm }}>
            Dark mode active
          </Text>
        </View>
      )}
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// OPTION 2: Complex Component (makeStyles Hook)
// Use for components with many styles or reusable style objects
// RECOMMENDED for most components
// ═══════════════════════════════════════════════════════════════════════════

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight, shadow, isDark }) => ({
  container: {
    backgroundColor: colors.card,
    padding: spacing[4],
    borderRadius: radius.xl,
    marginBottom: spacing[3],
    ...shadow.md,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.foreground,
  },
  
  subtitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.regular,
    color: colors.mutedForeground,
    marginBottom: spacing[2],
  },
  
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.lg,
    alignItems: 'center',
    ...shadow.sm,
  },
  
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semiBold,
    color: colors.primaryForeground,
  },
  
  // Example: Using withOpacity for transparent backgrounds
  badge: {
    backgroundColor: withOpacity(colors.primary, 0.1),
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
  },
  
  badgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: colors.primary,
  },
  
  // Example: Overlay colors
  overlay: {
    backgroundColor: colors.overlayLight,
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.overlayMedium,
  },
  
  // Example: Using theme colors for specific use cases
  successBadge: {
    backgroundColor: withOpacity(colors.success, 0.1),
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing[2],
    borderRadius: radius.md,
  },
  
  errorText: {
    color: colors.destructive,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  
  // Example: Avatar colors
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: colors.avatarPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Example: Notification colors
  notificationDot: {
    width: spacing[2],
    height: spacing[2],
    borderRadius: radius.full,
    backgroundColor: colors.notificationCoin,
  },
}));

export const ComplexComponent: React.FC<{
  title: string;
  subtitle: string;
  onPress: () => void;
}> = ({ title, subtitle, onPress }) => {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>New</Text>
          </View>
        </View>
        
        <View style={styles.avatar}>
          <Text style={{ color: colors.primaryForeground, fontSize: 20 }}>👤</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.overlay}>
        <Text style={{ color: colors.foreground }}>
          This uses overlay colors from theme
        </Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>Press Me</Text>
      </TouchableOpacity>

      {/* Example: Success state */}
      <View style={styles.successBadge}>
        <Text style={{ color: colors.success }}>✓ Success</Text>
      </View>

      {/* Example: Error state */}
      <Text style={styles.errorText}>This is an error message</Text>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// THEME REFERENCE GUIDE
// ═══════════════════════════════════════════════════════════════════════════

/*

COLORS (colors.xxx):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Base Colors:
  - background          Main background color
  - foreground          Main text color
  - card                Card background
  - cardForeground      Card text color

UI Colors:
  - primary             Primary brand color
  - primaryForeground   Text on primary color
  - secondary           Secondary background
  - secondaryForeground Text on secondary
  - muted               Muted background
  - mutedForeground     Muted text
  - accent              Accent background
  - accentForeground    Accent text
  - destructive         Error/danger color
  - destructiveForeground Text on destructive

Input Colors:
  - input               Input border
  - inputBackground     Input background
  - switchBackground    Switch track color
  - border              General border color
  - ring                Focus ring color

Semantic Colors:
  - success             Success state
  - warning             Warning state
  - gold                Gold/premium color
  - link                Link color

Notification Colors:
  - notificationChallenge  Challenge notifications (#8B5CF6)
  - notificationCoin       Coin notifications (#F5C518)
  - notificationProduct    Product notifications (#10B981)

Avatar Colors:
  - avatarPrimary       Blue avatar
  - avatarPurple        Purple avatar
  - avatarGreen         Green avatar
  - avatarOrange        Orange avatar
  - avatarRed           Red avatar
  - avatarPink          Pink avatar
  - avatarIndigo        Indigo avatar
  - avatarCyan          Cyan avatar

Tier/Premium Colors:
  - tierBackground      Tier card background
  - tierForeground      Tier card text
  - tierProgress        Tier progress bar

Overlay Colors:
  - overlayLight        Light overlay (rgba 0.06)
  - overlayMedium       Medium overlay (rgba 0.1)
  - overlayHeavy        Heavy overlay (rgba 0.2)

Chart Colors:
  - chart.c1 through chart.c5

Gradients:
  - gradient.primary    [start, end]
  - gradient.secondary  [start, end]


SPACING (spacing[n]):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  spacing[0]     = 0px
  spacing[0.5]   = 2px
  spacing[1]     = 4px
  spacing[1.25]  = 5px
  spacing[1.5]   = 6px
  spacing[2]     = 8px
  spacing[2.5]   = 10px
  spacing[3]     = 12px
  spacing[4]     = 16px   ← Most common
  spacing[5]     = 20px
  spacing[6]     = 24px
  spacing[7]     = 28px
  spacing[8]     = 32px
  spacing[10]    = 40px
  spacing[12]    = 48px
  spacing[14]    = 56px
  spacing[15]    = 60px
  spacing[16]    = 64px
  spacing[18]    = 72px
  spacing[20]    = 80px


RADIUS (radius.xxx):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  radius.none    = 0px
  radius.xs      = 4px
  radius.sm      = 6px
  radius.md      = 8px
  radius.lg      = 12px   ← Most common
  radius.xl      = 16px
  radius['2xl']  = 20px
  radius['3xl']  = 24px
  radius.full    = 9999px (perfect circle)


FONT SIZE (fontSize.xxx):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  fontSize.xs      = 11px
  fontSize.sm      = 12px
  fontSize.md      = 14px
  fontSize.base    = 16px   ← Body text
  fontSize.lg      = 17px   ← Headline
  fontSize.xl      = 20px
  fontSize['2xl']  = 22px
  fontSize['3xl']  = 26px
  fontSize['4xl']  = 28px
  fontSize['5xl']  = 34px   ← Large title


FONT WEIGHT (fontWeight.xxx):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  fontWeight.regular   = '400'
  fontWeight.medium    = '500'
  fontWeight.semiBold  = '600'  ← Most common for emphasis
  fontWeight.bold      = '700'


SHADOW (shadow.xxx):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  shadow.none     = {}
  shadow.shadow1  = Subtle shadow
  shadow.xs       = Extra small shadow
  shadow.sm       = Small shadow
  shadow.md       = Medium shadow  ← Most common
  shadow.lg       = Large shadow
  shadow.xl       = Extra large shadow

Usage: ...shadow.md (spread operator)


DARK MODE (isDark):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  isDark = true when dark mode is active
  
  Use for conditional logic:
  {isDark && <DarkModeOnlyComponent />}
  
  Or conditional styling:
  backgroundColor: isDark ? colors.card : colors.background


UTILITIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

withOpacity(color, opacity):
  Creates a transparent version of a color
  
  Example:
    backgroundColor: withOpacity(colors.primary, 0.1)
  
  Instead of:
    backgroundColor: 'rgba(0, 153, 255, 0.1)'  ❌


ANTI-PATTERNS (DON'T DO THIS):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ backgroundColor: '#FFFFFF'
✅ backgroundColor: colors.background

❌ color: 'rgba(255,255,255,0.5)'
✅ color: withOpacity(colors.foreground, 0.5)

❌ padding: 16
✅ padding: spacing[4]

❌ borderRadius: 12
✅ borderRadius: radius.lg

❌ fontSize: 14
✅ fontSize: fontSize.md

❌ fontWeight: '600'
✅ fontWeight: fontWeight.semiBold

❌ shadowColor: '#000', shadowOffset: {...}, shadowOpacity: 0.1
✅ ...shadow.md


BEST PRACTICES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Always use makeStyles for components with multiple styles
2. Use withOpacity for transparent colors
3. Test in both light and dark modes
4. Use semantic color names (primary, destructive, success)
5. Never hardcode colors, spacing, or typography
6. Use spread operator for shadows: ...shadow.md
7. Use bracket notation for numeric keys: fontSize['2xl']
8. Import only what you need from useTheme

*/
