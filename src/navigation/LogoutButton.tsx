import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography } from '../theme';

export default function LogoutButton() {
  const { logout } = useApp();
  return (
    <TouchableOpacity style={styles.btn} onPress={() => logout()} activeOpacity={0.78}>
      <Icon name="log-out" size={20} color={colors.primaryContrast} />
      <Text style={styles.text}>Logout</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  text: {
    color: colors.primaryContrast,
    ...typography.bodySemibold,
    fontSize: 15,
  },
});
