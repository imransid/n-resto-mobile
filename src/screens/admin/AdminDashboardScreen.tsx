import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, RefreshControl } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { database } from '../../database/databaseInstance';
import type Order from '../../database/Order';
import type FoodItem from '../../database/FoodItem';
import { useAuth } from '../../hooks/useAuth';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { resolveSessionCompanyId } from '../../utils/sessionCompanyId';
import {
  endOfLocalDayMs,
  isOrderCompletedInLocalDay,
  startOfLocalDayMs,
} from '../../utils/orderCompletedStats';

function StatCard({
  label,
  value,
  icon,
  delay,
}: {
  label: string;
  value: string;
  icon: string;
  delay: number;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify().damping(16)}
      style={styles.statCard}
    >
      <View style={styles.statIcon}>
        <Icon name={icon} size={22} color={colors.primary} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const { horizontalPadding, maxContentWidth, isTablet } = useResponsive();
  const companyId = useMemo(() => resolveSessionCompanyId(auth), [auth]);
  const scrollTabletLayout = useMemo(
    () => (isTablet ? { maxWidth: maxContentWidth, alignSelf: 'center' as const, width: '100%' as const } : null),
    [isTablet, maxContentWidth]
  );

  const [completedToday, setCompletedToday] = useState(0);
  const [availableItems, setAvailableItems] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const ordersCol = database.get<Order>('orders');
    const foodCol = database.get<FoodItem>('food_items');

    const ordersQuery = companyId
      ? ordersCol.query(Q.where('company_id', companyId))
      : ordersCol.query();

    const foodQuery = foodCol.query(Q.where('status', true));

    const sub1 = ordersQuery.observe().subscribe((rows) => {
      const now = new Date();
      const ds = startOfLocalDayMs(now);
      const de = endOfLocalDayMs(now);
      const n = rows.filter((o) => isOrderCompletedInLocalDay(o, ds, de)).length;
      setCompletedToday(n);
    });
    const sub2 = foodQuery.observe().subscribe((rows) => {
      setAvailableItems(rows.length);
    });

    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
    };
  }, [companyId]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const ordersCol = database.get<Order>('orders');
      const foodCol = database.get<FoodItem>('food_items');
      const ordersQuery = companyId
        ? ordersCol.query(Q.where('company_id', companyId))
        : ordersCol.query();
      const [orderRows, foodRows] = await Promise.all([
        ordersQuery.fetch(),
        foodCol.query(Q.where('status', true)).fetch(),
      ]);
      const now = new Date();
      const n = orderRows.filter((o) =>
        isOrderCompletedInLocalDay(o, startOfLocalDayMs(now), endOfLocalDayMs(now))
      ).length;
      setCompletedToday(n);
      setAvailableItems(foodRows.length);
    } finally {
      setRefreshing(false);
    }
  };

  const companyLine = companyId ? `Company ${companyId}` : 'All companies (no tenant id on session)';

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: horizontalPadding,
          },
          scrollTabletLayout,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>{companyLine}</Text>
        <Text style={styles.dayHint}>Today (local time)</Text>

        <View style={styles.grid}>
          <StatCard
            label="Orders completed today"
            value={String(completedToday)}
            icon="check-circle"
            delay={60}
          />
          <StatCard
            label="Food items available"
            value={String(availableItems)}
            icon="coffee"
            delay={120}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.note}>
          <Icon name="info" size={18} color={colors.textSubtle} style={styles.noteIcon} />
          <Text style={styles.noteText}>
            Completed orders use paid time when set, otherwise paid or delivered status for today. Menu count is items
            marked available in your synced catalog.
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const shadowSm = shadows.sm;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scrollContent: {
    flexGrow: 1,
  },
  title: {
    ...typography.h1,
    color: '#fff',
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSubtle,
    fontSize: 14,
    marginBottom: spacing.xxs,
  },
  dayHint: {
    ...typography.body,
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flexGrow: 1,
    minWidth: '44%',
    backgroundColor: colors.darkCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    ...Platform.select({
      ios: shadowSm,
      android: { elevation: 4 },
    }),
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    ...typography.body,
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  noteIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    ...typography.body,
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 20,
  },
});
