/**
 * Responsive scaling using react-native-size-matters.
 * Base guideline: 375 x 812 (iPhone X / standard phone).
 * Use scale for horizontal/layout, verticalScale for height, moderateScale for text/sizes.
 */

import {
  scale,
  verticalScale,
  moderateScale,
  moderateVerticalScale,
} from 'react-native-size-matters';
import type { ScaledSize } from 'react-native';
import { Dimensions } from 'react-native';

// Re-export for use in screens/hooks
export { scale, verticalScale, moderateScale, moderateVerticalScale };

/** Factor for moderateScale: 0.5 = balanced (avoids huge text on tablets) */
const MOD_FACTOR = 0.5;

/** Window dimensions (full ScaledSize or just width/height from useWindowDimensions) */
type WindowDims = ScaledSize | { width: number; height: number };

/**
 * Build spacing, radius, and typography scaled for current window dimensions.
 * Uses react-native-size-matters scale() for layout, moderateScale() for text/sizes.
 */
export function createScaledDesignSystem(window?: WindowDims) {
  // If explicit dimensions given (e.g. from useWindowDimensions), we need to scale manually
  // because size-matters uses Dimensions.get('window') at call time.
  const dims = window ?? Dimensions.get('window');
  const baseWidth = 375;
  const w = dims.width / baseWidth;
  const modX = (s: number, factor: number = MOD_FACTOR) =>
    Math.round(s * (1 + (w - 1) * factor));

  return {
    spacing: {
      xxs: modX(4),
      xs: modX(8),
      sm: modX(12),
      md: modX(16),
      lg: modX(20),
      xl: modX(24),
      xxl: modX(32),
      xxxl: modX(40),
      section: modX(48),
    },
    radius: {
      xs: modX(8),
      sm: modX(12),
      md: modX(16),
      lg: modX(20),
      xl: modX(24),
      full: 9999,
    },
    typography: {
      display: {
        fontSize: modX(28),
        fontWeight: '800' as const,
        lineHeight: modX(34),
        letterSpacing: -0.5,
      },
      h1: {
        fontSize: modX(22),
        fontWeight: '700' as const,
        lineHeight: modX(28),
        letterSpacing: -0.3,
      },
      h2: {
        fontSize: modX(18),
        fontWeight: '700' as const,
        lineHeight: modX(24),
      },
      h3: {
        fontSize: modX(16),
        fontWeight: '600' as const,
        lineHeight: modX(22),
      },
      body: {
        fontSize: modX(15),
        fontWeight: '400' as const,
        lineHeight: modX(22),
      },
      bodyMedium: {
        fontSize: modX(15),
        fontWeight: '500' as const,
        lineHeight: modX(22),
      },
      bodySemibold: {
        fontSize: modX(15),
        fontWeight: '600' as const,
        lineHeight: modX(22),
      },
      caption: {
        fontSize: modX(13),
        fontWeight: '500' as const,
        lineHeight: modX(18),
      },
      captionMuted: {
        fontSize: modX(12),
        fontWeight: '500' as const,
        lineHeight: modX(16),
      },
      chip: {
        fontSize: modX(13),
        fontWeight: '600' as const,
        lineHeight: modX(18),
      },
      price: {
        fontSize: modX(15),
        fontWeight: '700' as const,
        lineHeight: modX(20),
      },
      total: {
        fontSize: modX(20),
        fontWeight: '800' as const,
        lineHeight: modX(26),
        letterSpacing: -0.5,
      },
    },
    touchTargetMin: Math.max(44, modX(44)),
  };
}

/** Cached scaled design system (current window at first load / last update) */
let cached: ReturnType<typeof createScaledDesignSystem> | null = null;

/**
 * Get scaled design system for current dimensions.
 * Uses cache; for orientation/split-screen updates use useScaledTheme() in components.
 */
export function getScaledDesignSystem(): ReturnType<typeof createScaledDesignSystem> {
  if (cached == null) {
    cached = createScaledDesignSystem();
  }
  return cached;
}

/**
 * Clear cache (e.g. when dimensions change). useScaledTheme calls this internally.
 */
export function clearScaledDesignSystemCache(): void {
  cached = null;
}
