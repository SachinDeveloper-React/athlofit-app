# Quick Theme Replacement Patterns

Use these find-and-replace patterns to quickly update files. Always test after replacing!

## Color Replacements

### White/Foreground Colors
```
Find: '#FFFFFF'
Replace: colors.primaryForeground

Find: '#fff'
Replace: colors.primaryForeground

Find: 'white'
Replace: colors.primaryForeground
```

### Black/Background Colors
```
Find: '#000000'
Replace: colors.foreground

Find: '#000'
Replace: colors.foreground

Find: 'black'
Replace: colors.foreground
```

### RGBA Overlays
```
Find: 'rgba(255,255,255,0.06)'
Replace: colors.overlayLight

Find: 'rgba(255,255,255,0.08)'
Replace: colors.overlayLight

Find: 'rgba(255,255,255,0.1)'
Replace: colors.overlayMedium

Find: 'rgba(255,255,255,0.2)'
Replace: colors.overlayHeavy

Find: 'rgba(0,0,0,0.45)'
Replace: withOpacity(colors.foreground, 0.45)
```

### Common Colors
```
Find: C.white
Replace: colors.primaryForeground

Find: C.muted
Replace: colors.mutedForeground

Find: C.gold
Replace: colors.gold

Find: C.blue
Replace: colors.primary

Find: C.teal
Replace: colors.avatarCyan

Find: C.accent
Replace: colors.accent
```

## Spacing Replacements

### Margins
```
Find: marginTop: 16
Replace: marginTop: spacing[4]

Find: marginBottom: 16
Replace: marginBottom: spacing[4]

Find: marginLeft: 16
Replace: marginLeft: spacing[4]

Find: marginRight: 16
Replace: marginRight: spacing[4]

Find: margin: 16
Replace: margin: spacing[4]
```

### Padding
```
Find: padding: 16
Replace: padding: spacing[4]

Find: paddingHorizontal: 16
Replace: paddingHorizontal: spacing[4]

Find: paddingVertical: 16
Replace: paddingVertical: spacing[4]

Find: paddingTop: 16
Replace: paddingTop: spacing[4]

Find: paddingBottom: 16
Replace: paddingBottom: spacing[4]
```

### Common Spacing Values
```
4 → spacing[1]
8 → spacing[2]
10 → spacing[2.5]
12 → spacing[3]
16 → spacing[4]
20 → spacing[5]
24 → spacing[6]
32 → spacing[8]
```

## Border Radius Replacements

```
Find: borderRadius: 4
Replace: borderRadius: radius.xs

Find: borderRadius: 8
Replace: borderRadius: radius.md

Find: borderRadius: 12
Replace: borderRadius: radius.lg

Find: borderRadius: 14
Replace: borderRadius: radius.lg

Find: borderRadius: 16
Replace: borderRadius: radius.xl

Find: borderRadius: 20
Replace: borderRadius: radius['2xl']

Find: borderRadius: 24
Replace: borderRadius: radius['3xl']

Find: borderRadius: 999
Replace: borderRadius: radius.full

Find: borderRadius: 9999
Replace: borderRadius: radius.full
```

## Font Size Replacements

```
Find: fontSize: 11
Replace: fontSize: fontSize.xs

Find: fontSize: 12
Replace: fontSize: fontSize.sm

Find: fontSize: 13
Replace: fontSize: fontSize.sm

Find: fontSize: 14
Replace: fontSize: fontSize.md

Find: fontSize: 16
Replace: fontSize: fontSize.base

Find: fontSize: 17
Replace: fontSize: fontSize.lg

Find: fontSize: 18
Replace: fontSize: fontSize.lg

Find: fontSize: 20
Replace: fontSize: fontSize.xl

Find: fontSize: 22
Replace: fontSize: fontSize['2xl']

Find: fontSize: 26
Replace: fontSize: fontSize['3xl']

Find: fontSize: 28
Replace: fontSize: fontSize['4xl']

Find: fontSize: 32
Replace: fontSize: fontSize['5xl']

Find: fontSize: 34
Replace: fontSize: fontSize['5xl']
```

## Font Weight Replacements

```
Find: fontWeight: '400'
Replace: fontWeight: fontWeight.regular

Find: fontWeight: '500'
Replace: fontWeight: fontWeight.medium

Find: fontWeight: '600'
Replace: fontWeight: fontWeight.semiBold

Find: fontWeight: '700'
Replace: fontWeight: fontWeight.bold

Find: fontWeight: '800'
Replace: fontWeight: fontWeight.bold

Find: fontWeight: '900'
Replace: fontWeight: fontWeight.bold
```

## Import Additions

### Add to imports at top of file:
```typescript
import { useTheme } from '../../../hooks/useTheme';  // Adjust path as needed
import { withOpacity } from '../../../utils/withOpacity';  // If using opacity
```

### Add to component:
```typescript
const { colors, spacing, radius, fontSize, fontWeight, shadow, isDark } = useTheme();
```

## StyleSheet Conversion

### Before (StyleSheet.create):
```typescript
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    fontSize: 14,
  },
});
```

### After (Inline with theme):
```typescript
const { colors, spacing, radius, fontSize } = useTheme();

// Use inline styles:
<View style={{
  backgroundColor: colors.background,
  padding: spacing[4],
  borderRadius: radius.lg,
}}>
  <Text style={{ fontSize: fontSize.md }}>...</Text>
</View>
```

### Or After (makeStyles):
```typescript
import { makeStyles } from '../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize }) => ({
  container: {
    backgroundColor: colors.background,
    padding: spacing[4],
    borderRadius: radius.lg,
  },
  text: {
    fontSize: fontSize.md,
  },
}));

// In component:
const styles = useStyles();
```

## Shadow Replacements

### Remove hardcoded shadows:
```typescript
// Before:
shadowColor: '#000',
shadowOffset: { width: 0, height: 2 },
shadowOpacity: 0.1,
shadowRadius: 4,
elevation: 2,

// After:
...shadow.sm
```

### Shadow mapping:
```
Small shadow → shadow.sm
Medium shadow → shadow.md
Large shadow → shadow.lg
Extra large → shadow.xl
```

## Common Patterns

### Pattern 1: Replace C.constant with colors
```
Find: C.white
Replace: colors.primaryForeground

Find: C.bg1
Replace: colors.background

Find: C.foreground
Replace: colors.foreground
```

### Pattern 2: Replace hardcoded gaps
```
Find: gap: 8
Replace: gap: spacing[2]

Find: gap: 12
Replace: gap: spacing[3]

Find: gap: 16
Replace: gap: spacing[4]
```

### Pattern 3: Replace hardcoded heights/widths (when they're spacing-related)
```
Find: height: 8
Replace: height: spacing[2]

Find: height: 10
Replace: height: spacing[2.5]

Find: width: 8
Replace: width: spacing[2]
```

## Verification Checklist

After making replacements:

- [ ] Add `useTheme` import
- [ ] Add `withOpacity` import (if needed)
- [ ] Destructure theme in component
- [ ] Replace all hex colors
- [ ] Replace all rgba colors
- [ ] Replace all hardcoded spacing
- [ ] Replace all hardcoded font sizes
- [ ] Replace all hardcoded font weights
- [ ] Replace all hardcoded border radius
- [ ] Replace all hardcoded shadows
- [ ] Test in light mode
- [ ] Test in dark mode
- [ ] Check for TypeScript errors
- [ ] Check for runtime errors

## Tips

1. **Use VS Code's Find & Replace** (Cmd/Ctrl + H) with regex enabled
2. **Replace one pattern at a time** to avoid mistakes
3. **Test after each major change** to catch errors early
4. **Use the template file** as reference: `THEME_COMPONENT_TEMPLATE.tsx`
5. **Check diagnostics** after changes: Run `getDiagnostics` on the file
6. **Commit frequently** so you can revert if needed

## Common Mistakes to Avoid

❌ **Don't do this:**
```typescript
// Forgetting to destructure theme
const theme = useTheme();
backgroundColor: theme.colors.background  // Too verbose

// Using wrong spacing
padding: spacing.4  // Wrong - spacing is an object with numeric keys

// Mixing hardcoded and theme values
backgroundColor: colors.card,
padding: 16,  // Should be spacing[4]
```

✅ **Do this:**
```typescript
// Destructure what you need
const { colors, spacing, radius } = useTheme();
backgroundColor: colors.background

// Use bracket notation for spacing
padding: spacing[4]

// Be consistent - all theme or all hardcoded (prefer all theme)
backgroundColor: colors.card,
padding: spacing[4],
borderRadius: radius.lg,
```
