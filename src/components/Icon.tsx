import React, { memo, useMemo } from 'react';
import type { ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

// ─── Curated icon imports (tree-shakeable) ────────────────────────────────────
// Only icons actually used in the app are imported. This reduces the JS bundle
// by ~300KB+ compared to `import * as Icons from 'lucide-react-native'`.
import {
  Activity,
  AlertCircle,
  Apple,
  ArrowLeft,
  Award,
  BadgeDollarSign,
  BadgePercent,
  Ban,
  BarChart2,
  Bell,
  BellOff,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Coins,
  Copy,
  Droplet,
  Droplets,
  Dumbbell,
  FileText,
  Flame,
  Footprints,
  Gift,
  Globe,
  HandCoins,
  Heart,
  HeartPulse,
  History,
  Home,
  Image,
  Images,
  IndianRupee,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  PackageCheck,
  PenLine,
  Pencil,
  PersonStanding,
  Phone,
  Pill,
  Plus,
  PlusCircle,
  RefreshCw,
  Scale,
  Search,
  SearchX,
  ServerCrash,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Star,
  Swords,
  Target,
  Ticket,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
  User,
  Wallet,
  Watch,
  WifiOff,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react-native';

// ─── Icon Registry ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Activity,
  AlertCircle,
  Apple,
  ArrowLeft,
  Award,
  BadgeDollarSign,
  BadgePercent,
  Ban,
  BarChart2,
  Bell,
  BellOff,
  Briefcase,
  Building2,
  CalendarDays,
  Camera,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Coins,
  Copy,
  Droplet,
  Droplets,
  Dumbbell,
  FileText,
  Flame,
  Footprints,
  Gift,
  Globe,
  HandCoins,
  Heart,
  HeartPulse,
  History,
  Home,
  Image,
  Images,
  IndianRupee,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Package,
  PackageCheck,
  PenLine,
  Pencil,
  PersonStanding,
  Phone,
  Pill,
  Plus,
  PlusCircle,
  RefreshCw,
  Scale,
  Search,
  SearchX,
  ServerCrash,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Star,
  Swords,
  Target,
  Ticket,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Trophy,
  Truck,
  User,
  Wallet,
  Watch,
  WifiOff,
  Wrench,
  X,
  XCircle,
  Zap,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type LucideName = keyof typeof ICON_MAP;

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
   */
  color?: ColorToken | (string & {});
  strokeWidth?: number;
  /** Filled variant — sets fill to the resolved color and strokeWidth to 0 */
  filled?: boolean;
  style?: ViewStyle;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
};

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

    const IconComponent = ICON_MAP[name];

    const resolvedColor = useMemo(() => {
      if (!color) return colors.foreground;
      return isColorToken(color) ? colors[color] : color;
    }, [color, colors]);

    if (!IconComponent) {
      if (__DEV__) console.warn(`[Icon] Unknown icon: "${name}". Add it to ICON_MAP in Icon.tsx`);
      return null;
    }

    return (
      <IconComponent
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
