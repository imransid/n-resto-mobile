export { colors } from './colors';
export type { Colors } from './colors';
export { shadows } from './designSystem';
export type { SpacingKey, RadiusKey } from './designSystem';

// Responsive: scaled for current device (react-native-size-matters approach)
import { getScaledDesignSystem } from '../utils/scaling';

const scaled = getScaledDesignSystem();
export const spacing = scaled.spacing;
export const radius = scaled.radius;
export const typography = scaled.typography;
export const touchTargetMin = scaled.touchTargetMin;
