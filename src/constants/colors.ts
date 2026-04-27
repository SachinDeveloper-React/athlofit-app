// src/constants/colors.ts

// ─── Structural interface (no literal types) ──────────────────────────────────
// Using an interface instead of `typeof lightColors` means dark/light palettes
// are both assignable to ThemeColors without TypeScript complaining about
// mismatched string literals.

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  inputBackground: string;
  switchBackground: string;
  ring: string;
  link: string;
  success: string;
  warning: string;
  gold: string;
  // Notification colors
  notificationChallenge: string;
  notificationCoin: string;
  notificationProduct: string;
  // Avatar colors
  avatarPrimary: string;
  avatarPurple: string;
  avatarGreen: string;
  avatarOrange: string;
  avatarRed: string;
  avatarPink: string;
  avatarIndigo: string;
  avatarCyan: string;
  // Tier/Premium colors
  tierBackground: string;
  tierForeground: string;
  tierProgress: string;
  // Overlay colors
  overlayLight: string;
  overlayMedium: string;
  overlayHeavy: string;
  chart: {
    c1: string;
    c2: string;
    c3: string;
    c4: string;
    c5: string;
  };
  gradient: {
    primary: [string, string];
    secondary: [string, string];
  };
  sidebar: {
    background: string;
    foreground: string;
    primary: string;
    primaryForeground: string;
    accent: string;
    accentForeground: string;
    border: string;
    ring: string;
  };
}

// ─── Light palette ────────────────────────────────────────────────────────────

export const lightColors: ThemeColors = {
  background: '#FFFFFF',
  foreground: '#0B1220',
  card: '#FFFFFF',
  cardForeground: '#0B1220',
  popover: '#FFFFFF',
  popoverForeground: '#0B1220',
  primary: '#0099FF',
  primaryForeground: '#FFFFFF',
  secondary: '#F2F2F7',
  secondaryForeground: '#030213',
  muted: '#ECECF0',
  mutedForeground: '#717182',
  accent: '#E9EBEF',
  accentForeground: '#030213',
  destructive: '#D4183D',
  destructiveForeground: '#FFFFFF',
  border: 'rgba(0, 0, 0, 0.1)',
  input: 'transparent',
  inputBackground: '#F3F3F5',
  switchBackground: '#CBCED4',
  ring: '#B3B3B3',
  link: '#0000EE',
  success: '#008000',
  warning: '#FFA500',
  gold: '#FFB800',
  // Notification colors
  notificationChallenge: '#8B5CF6',
  notificationCoin: '#F5C518',
  notificationProduct: '#10B981',
  // Avatar colors
  avatarPrimary: '#0099FF',
  avatarPurple: '#6B5CFF',
  avatarGreen: '#10B981',
  avatarOrange: '#F59E0B',
  avatarRed: '#EF4444',
  avatarPink: '#EC4899',
  avatarIndigo: '#8B5CF6',
  avatarCyan: '#06B6D4',
  // Tier/Premium colors
  tierBackground: '#0B1220',
  tierForeground: '#FFFFFF',
  tierProgress: '#FFB000',
  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.06)',
  overlayMedium: 'rgba(255, 255, 255, 0.1)',
  overlayHeavy: 'rgba(255, 255, 255, 0.2)',
  chart: {
    c1: '#E57A2E',
    c2: '#3AA6A6',
    c3: '#2F5C7A',
    c4: '#F0D24A',
    c5: '#F2C24A',
  },
  gradient: {
    primary: ['#0099FF', '#00C6FF'],
    secondary: ['#0099FF', '#1BC5BD'],
  },
  sidebar: {
    background: '#FBFBFB',
    foreground: '#0B1220',
    primary: '#030213',
    primaryForeground: '#FBFBFB',
    accent: '#F7F7F7',
    accentForeground: '#2E2E2E',
    border: '#EAEAEA',
    ring: '#B3B3B3',
  },
};

// ─── Dark palette ─────────────────────────────────────────────────────────────

export const darkColors: ThemeColors = {
  background: '#0B0F18',
  foreground: '#F5F7FF',
  card: '#0B0F18',
  cardForeground: '#F5F7FF',
  popover: '#0B0F18',
  popoverForeground: '#F5F7FF',
  primary: '#0099FF',
  primaryForeground: '#1F2430',
  secondary: '#2B2F3A',
  secondaryForeground: '#F5F7FF',
  muted: '#2B2F3A',
  mutedForeground: '#B3B9C5',
  accent: '#2B2F3A',
  accentForeground: '#F5F7FF',
  destructive: '#7A2B2B',
  destructiveForeground: '#FF6B6B',
  border: '#2B2F3A',
  input: '#2B2F3A',
  inputBackground: '#1A1F2A',
  switchBackground: '#3A3F4A',
  ring: '#6E7380',
  link: '#0000EE',
  success: '#008000',
  warning: '#FFA500',
  gold: '#FFB800',
  // Notification colors
  notificationChallenge: '#8B5CF6',
  notificationCoin: '#F5C518',
  notificationProduct: '#10B981',
  // Avatar colors
  avatarPrimary: '#0099FF',
  avatarPurple: '#6B5CFF',
  avatarGreen: '#10B981',
  avatarOrange: '#F59E0B',
  avatarRed: '#EF4444',
  avatarPink: '#EC4899',
  avatarIndigo: '#8B5CF6',
  avatarCyan: '#06B6D4',
  // Tier/Premium colors
  tierBackground: '#1F2430',
  tierForeground: '#F5F7FF',
  tierProgress: '#FFB000',
  // Overlay colors
  overlayLight: 'rgba(0, 0, 0, 0.06)',
  overlayMedium: 'rgba(0, 0, 0, 0.1)',
  overlayHeavy: 'rgba(0, 0, 0, 0.2)',
  chart: {
    c1: '#6B5CFF',
    c2: '#4AD1B3',
    c3: '#F2C24A',
    c4: '#B455FF',
    c5: '#FF6B5A',
  },
  gradient: {
    primary: ['#0099FF', '#00C6FF'],
    secondary: ['#0099FF', '#1BC5BD'],
  },
  sidebar: {
    background: '#1F2430',
    foreground: '#F5F7FF',
    primary: '#6B5CFF',
    primaryForeground: '#F5F7FF',
    accent: '#2B2F3A',
    accentForeground: '#F5F7FF',
    border: '#2B2F3A',
    ring: '#6E7380',
  },
};
