/**
 * Returns scaled spacing, radius, typography that update when dimensions change
 * (orientation / split screen). Use in screens that need live-responsive layout.
 */

import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';
import { createScaledDesignSystem } from '../utils/scaling';

/**
 * Returns spacing, radius, typography, touchTargetMin scaled for current window.
 * Updates when dimensions change (orientation / split screen).
 */
export function useScaledTheme() {
  const { width, height } = useWindowDimensions();

  return useMemo(
    () => createScaledDesignSystem({ width, height }),
    [width, height]
  );
}
