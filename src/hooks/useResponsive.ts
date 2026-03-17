/**
 * Hook that returns current dimensions and responsive helpers.
 * Re-renders when window dimensions change (orientation / split screen).
 * Uses same base as react-native-size-matters (375 x 812).
 */

import { useWindowDimensions, PixelRatio } from 'react-native';
import { useMemo } from 'react';
import {
  scale,
  verticalScale,
  moderateScale,
  moderateVerticalScale,
} from '../utils/scaling';

const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

export function useResponsive() {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const rw = (size: number) => Math.round((width / BASE_WIDTH) * size);
    const rh = (size: number) => Math.round((height / BASE_HEIGHT) * size);
    const rmin = (size: number) =>
      PixelRatio.roundToNearestPixel(
        size * Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)
      );

    const numColumns = width >= 768 ? 4 : width >= 600 ? 3 : 2;
    const horizontalPadding = width >= 768 ? scale(24) : width >= 600 ? scale(20) : scale(16);
    const cartSheetHeightRatio = height < 600 ? 0.82 : height < 700 ? 0.85 : 0.88;
    const maxContentWidth = width >= 1024 ? 900 : width >= 768 ? 700 : width;

    return {
      width,
      height,
      scale,
      verticalScale,
      moderateScale,
      moderateVerticalScale,
      rw,
      rh,
      rmin,
      numColumns,
      horizontalPadding,
      cartSheetHeightRatio,
      maxContentWidth,
      isSmallDevice: width < 375,
      isTablet: width >= 600,
      isLargeTablet: width >= 768,
    };
  }, [width, height]);
}
