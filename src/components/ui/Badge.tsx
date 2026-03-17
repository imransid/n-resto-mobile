/**
 * Numeric or dot badge — design system.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius, typography } from '../../theme';

export interface BadgeProps {
  count: number;
  max?: number;
  style?: ViewStyle;
}

export function Badge({ count, max = 99, style }: BadgeProps) {
  const display = count > max ? `${max}+` : String(count);
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text} allowFontScaling={false}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  text: {
    ...typography.chip,
    fontSize: 11,
    color: colors.primaryContrast,
  },
});
