/**
 * Primary / Secondary / Ghost / Danger buttons — design system only.
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, typography, touchTargetMin, shadows } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  onPress: () => void;
  label: string;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  compact?: boolean;
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary: { bg: colors.primary, text: colors.primaryContrast },
  secondary: { bg: colors.surfaceSecondary, text: colors.text, border: colors.border },
  ghost: { bg: 'transparent', text: colors.primary },
  danger: { bg: colors.error, text: colors.primaryContrast },
};

export function Button({
  onPress,
  label,
  variant = 'primary',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  compact = false,
}: ButtonProps) {
  const v = variantStyles[variant];
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        { backgroundColor: v.bg, borderWidth: v.border ? 1.5 : 0, borderColor: v.border },
        isPrimary && shadows.md,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {leftIcon}
          <Text style={[styles.label, { color: v.text }, textStyle]}>{label}</Text>
          {rightIcon}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    minHeight: touchTargetMin,
  },
  regular: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  compact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...typography.bodySemibold,
    fontSize: 16,
  },
});
