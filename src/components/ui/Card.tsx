/**
 * Card container — design system spacing & shadow.
 */
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radius, shadows } from '../../theme';

export interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  noShadow?: boolean;
}

export function Card({ children, style, padded = true, noShadow }: CardProps) {
  return (
    <View style={[styles.card, !noShadow && shadows.sm, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  padded: {
    padding: spacing.lg,
  },
});
