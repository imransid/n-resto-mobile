import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { PressableScale } from '../../components/ui';
import LogoutButton from '../../navigation/LogoutButton';
import type { AuthenticatedStackParamList } from '../../navigation/types';

export default function AdminHubScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<AuthenticatedStackParamList>>();
  const { horizontalPadding, maxContentWidth, isTablet } = useResponsive();
  const contentLayout = useMemo(
    () => (isTablet ? { maxWidth: maxContentWidth, alignSelf: 'center' as const, width: '100%' as const } : null),
    [isTablet, maxContentWidth]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.topBar, { paddingHorizontal: horizontalPadding }]}>
        <Text style={styles.topTitle}>Admin</Text>
        <LogoutButton />
      </View>
      <View
        style={[
          styles.content,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 },
          contentLayout,
        ]}
      >
        <Animated.View entering={FadeInDown.delay(40).duration(420).springify()} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="shield" size={36} color={colors.primaryContrast} />
          </View>
          <Text style={styles.heroTitle}>Where to next?</Text>
          <Text style={styles.heroHint}>
            Dashboard, kitchen line, or POS — pick where you’re working.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(440).springify()} style={styles.cards}>
          <PressableScale
            style={styles.card}
            activeScale={0.98}
            onPress={() => navigation.navigate('AdminDashboard')}
          >
            <View style={[styles.cardIcon, styles.cardIconDash]}>
              <Icon name="bar-chart-2" size={28} color={colors.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Dashboard</Text>
              <Text style={styles.cardSub}>Completed orders today · menu availability</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textSubtle} />
          </PressableScale>

          <PressableScale
            style={styles.card}
            activeScale={0.98}
            onPress={() => navigation.navigate('Kitchen')}
          >
            <View style={[styles.cardIcon, styles.cardIconKitchen]}>
              <Icon name="clipboard" size={28} color="#fb923c" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Kitchen</Text>
              <Text style={styles.cardSub}>Live tickets · advance prep · dine-in & pickup</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textSubtle} />
          </PressableScale>

          <PressableScale
            style={styles.card}
            activeScale={0.98}
            onPress={() => navigation.navigate('PurchaseRequisition')}
          >
            <View style={[styles.cardIcon, styles.cardIconRequisition]}>
              <Icon name="shopping-cart" size={28} color="#38bdf8" />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Purchase Requisition</Text>
              <Text style={styles.cardSub}>Chef requests · urgent needs · procurement list</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textSubtle} />
          </PressableScale>

          <PressableScale
            style={styles.card}
            activeScale={0.98}
            onPress={() => navigation.navigate('Main', { screen: 'POS' })}
          >
            <View style={[styles.cardIcon, styles.cardIconPos]}>
              <Icon name="shopping-bag" size={28} color={colors.primary} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>Point of Sale</Text>
              <Text style={styles.cardSub}>Take orders, tables, and payments</Text>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textSubtle} />
          </PressableScale>
        </Animated.View>
      </View>
    </View>
  );
}

const shadowMd = shadows.md;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  topTitle: {
    ...typography.h1,
    color: '#fff',
    fontSize: 22,
  },
  content: {
    flex: 1,
  },
  hero: {
    marginBottom: spacing.xl,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: 'rgba(5, 150, 105, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    color: '#fff',
    fontSize: 26,
    marginBottom: spacing.xs,
  },
  heroHint: {
    ...typography.body,
    color: colors.textSubtle,
    fontSize: 15,
    lineHeight: 22,
  },
  cards: {
    gap: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.darkCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    ...Platform.select({
      ios: shadowMd,
      android: { elevation: 6 },
    }),
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardIconDash: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  cardIconPos: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  cardIconKitchen: {
    backgroundColor: 'rgba(251, 146, 60, 0.14)',
  },
  cardIconRequisition: {
    backgroundColor: 'rgba(56, 189, 248, 0.16)',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    ...typography.bodySemibold,
    color: '#fff',
    fontSize: 17,
    marginBottom: 4,
  },
  cardSub: {
    ...typography.body,
    color: colors.textSubtle,
    fontSize: 13,
  },
});
