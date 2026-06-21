// src/utils/responsive.ts
//
// Responsive scaling utilities for consistent sizing across all screen sizes.
// Based on a standard 375×812 design (iPhone X/11/12/13 base).
// Usage:
//   import { s, vs, ms, wp, hp } from '../utils/responsive';
//   fontSize: ms(16)     → moderately scaled font
//   width: s(200)        → horizontally scaled
//   height: vs(100)      → vertically scaled
//   width: wp(80)        → 80% of screen width

import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design base dimensions (iPhone X)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

/**
 * Horizontal scale — scales a value based on screen width ratio.
 * Use for widths, horizontal paddings/margins, border radius.
 */
export const s = (size: number): number =>
  (SCREEN_WIDTH / BASE_WIDTH) * size;

/**
 * Vertical scale — scales a value based on screen height ratio.
 * Use for heights, vertical paddings/margins, line heights.
 */
export const vs = (size: number): number =>
  (SCREEN_HEIGHT / BASE_HEIGHT) * size;

/**
 * Moderate scale — scales with a dampening factor to avoid extremes.
 * Best for font sizes and icon sizes where large scaling looks bad.
 * @param factor 0–1, default 0.5. Lower = less scaling.
 */
export const ms = (size: number, factor: number = 0.5): number =>
  size + (s(size) - size) * factor;

/**
 * Width percentage — returns a value as percentage of screen width.
 */
export const wp = (percentage: number): number =>
  (percentage / 100) * SCREEN_WIDTH;

/**
 * Height percentage — returns a value as percentage of screen height.
 */
export const hp = (percentage: number): number =>
  (percentage / 100) * SCREEN_HEIGHT;

/**
 * Check if device is a small screen (width < 360)
 */
export const isSmallDevice = SCREEN_WIDTH < 360;

/**
 * Check if device is a large screen (width >= 414)
 */
export const isLargeDevice = SCREEN_WIDTH >= 414;

export { SCREEN_WIDTH, SCREEN_HEIGHT };
