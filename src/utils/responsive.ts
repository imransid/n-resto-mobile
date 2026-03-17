/**
 * Responsive utilities for all device sizes.
 * Base design: 375 x 812 (iPhone X / small phone).
 */

import { Dimensions, PixelRatio, ScaledSize } from 'react-native';
import { scale } from './scaling';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export function getWindowDimensions(): ScaledSize {
  return Dimensions.get('window');
}

/** Scale a size by width (good for horizontal spacing, widths) */
export function scaleByWidth(size: number): number {
  const { width } = getWindowDimensions();
  return PixelRatio.roundToNearestPixel((width / BASE_WIDTH) * size);
}

/** Scale a size by height (good for vertical spacing, heights) */
export function scaleByHeight(size: number): number {
  const { height } = getWindowDimensions();
  return PixelRatio.roundToNearestPixel((height / BASE_HEIGHT) * size);
}

/** Moderate scale: mix of width scale with factor to avoid huge text on tablets (0–1, 0.5 = balanced) */
export function moderateScale(size: number, factor: number = 0.5): number {
  const { width } = getWindowDimensions();
  const scaleRatio = width / BASE_WIDTH;
  const moderated = 1 + (scaleRatio - 1) * factor;
  return PixelRatio.roundToNearestPixel(size * moderated);
}

/** Use the smaller of width/height scale so elements fit on screen */
export function scaleMin(size: number): number {
  const { width, height } = getWindowDimensions();
  const scaleW = width / BASE_WIDTH;
  const scaleH = height / BASE_HEIGHT;
  return PixelRatio.roundToNearestPixel(size * Math.min(scaleW, scaleH));
}

export function isSmallDevice(): boolean {
  const { width } = getWindowDimensions();
  return width < 375;
}

export function isTablet(): boolean {
  const { width } = getWindowDimensions();
  return width >= 600;
}

export function isLargeTablet(): boolean {
  const { width } = getWindowDimensions();
  return width >= 768;
}

/** Number of columns for food/product grids: 2 phone, 3 tablet, 4 large tablet */
export function getGridColumns(): number {
  const { width } = getWindowDimensions();
  if (width >= 768) return 4;
  if (width >= 600) return 3;
  if (width >= 400) return 2;
  return 2;
}

/** Horizontal padding for content (responsive, scaled) */
export function getHorizontalPadding(): number {
  const { width } = getWindowDimensions();
  if (width >= 768) return scale(24);
  if (width >= 600) return scale(20);
  return scale(16);
}

/** Max content width for tablets (center content on large screens) */
export function getMaxContentWidth(): number {
  const { width } = getWindowDimensions();
  if (width >= 1024) return 900;
  if (width >= 768) return 700;
  return width;
}

/** Cart sheet height as % of screen (slightly smaller on very small devices) */
export function getCartSheetHeightRatio(): number {
  const { height } = getWindowDimensions();
  if (height < 600) return 0.82;
  if (height < 700) return 0.85;
  return 0.88;
}
