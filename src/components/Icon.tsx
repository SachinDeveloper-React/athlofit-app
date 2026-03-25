import React, { memo, useMemo } from 'react';
import * as Icons from 'lucide-react-native';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Only valid renderable Lucide icon keys (strips out non-component exports
 * like `createLucideIcon`, `default`, version strings, etc.)
 */
export type LucideName = {
  [K in keyof typeof Icons]: (typeof Icons)[K] extends React.ComponentType<any>
    ? K
    : never;
}[keyof typeof Icons];

type ColorToken =
  | 'foreground'
  | 'primary'
  | 'muted'
  | 'destructive'
  | 'card'
  | 'border';

type Props = {
  name: LucideName;

  size?: number;

  /**
   * Pass a raw hex/rgb string OR a theme color token.
   * Token → resolved from theme.colors at render time.
   * @example color="primary"  color="#FF0000"
   */
  color?: ColorToken | (string & {});

  strokeWidth?: number;

  /** Filled variant — sets fill to the resolved color and strokeWidth to 0 */
  filled?: boolean;

  style?: ViewStyle;

  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
};

// ─── Cache ────────────────────────────────────────────────────────────────────

/**
 * Module-level icon lookup cache so we don't re-index the Icons namespace
 * on every render (Icons has ~300 entries).
 */
const iconCache = new Map<string, React.ComponentType<any>>();

function getIcon(name: string): React.ComponentType<any> | null {
  if (iconCache.has(name)) return iconCache.get(name)!;

  const Icon = (Icons as Record<string, unknown>)[name];
  if (typeof Icon !== 'function' && typeof Icon !== 'object') return null;

  iconCache.set(name, Icon as React.ComponentType<any>);
  return Icon as React.ComponentType<any>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const COLOR_TOKENS = new Set<ColorToken>([
  'foreground',
  'primary',
  'muted',
  'destructive',
  'card',
  'border',
]);

function isColorToken(value: string): value is ColorToken {
  return COLOR_TOKENS.has(value as ColorToken);
}

export const Icon: React.FC<Props> = memo(
  ({
    name,
    size = 22,
    color,
    strokeWidth = 2,
    filled = false,
    style,
    accessibilityLabel,
  }) => {
    const { colors } = useTheme();

    const Icon = getIcon(name);

    const resolvedColor = useMemo(() => {
      if (!color) return colors.foreground;
      return isColorToken(color) ? colors[color] : color;
    }, [color, colors]);

    if (!Icon) {
      if (__DEV__) console.warn(`[AppIcon] Unknown icon: "${name}"`);
      return null;
    }

    return (
      <Icon
        size={size}
        color={resolvedColor}
        strokeWidth={filled ? 0 : strokeWidth}
        fill={filled ? resolvedColor : 'none'}
        style={style}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="image"
        accessible={!!accessibilityLabel}
      />
    );
  },
);

Icon.displayName = 'Icon';
