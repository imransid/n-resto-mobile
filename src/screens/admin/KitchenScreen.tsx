import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { useApp } from '../../context/AppContext';
import { colors, spacing, radius, typography, shadows } from '../../theme';
import { useResponsive } from '../../hooks/useResponsive';
import { PressableScale } from '../../components/ui';
import type { CompletedOrder, OrderStatus } from '../../types/pos';
import { ORDER_TYPE_EMOJI } from '../../constants/appIcons';

const PIPELINE: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'];

const COLUMN_LABELS: Record<OrderStatus, string> = {
  PENDING: 'New',
  CONFIRMED: 'Queued',
  PREPARING: 'Cooking',
  READY: 'Ready',
  DELIVERED: 'Served',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

const COLUMN_HINTS: Record<OrderStatus, string> = {
  PENDING: 'Tap Accept to start',
  CONFIRMED: 'Waiting for the line',
  PREPARING: 'On the pass soon',
  READY: 'Hand off to floor',
  DELIVERED: '',
  PAID: '',
  CANCELLED: '',
};

const STATUS_ACCENT: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  PREPARING: '#a855f7',
  READY: '#059669',
  DELIVERED: '#64748b',
  PAID: '#64748b',
  CANCELLED: '#64748b',
};

type TypeFilter = 'all' | 'DINE_IN' | 'AWAY';

function shortId(id: string): string {
  if (id.startsWith('ORD')) return id.slice(-6);
  const parts = id.split('_');
  return parts.length > 1 ? parts[parts.length - 1] : id.slice(-6);
}

function waitLabel(iso: string): string {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function nextKitchenStep(
  status: OrderStatus
): { label: string; next: OrderStatus } | null {
  switch (status) {
    case 'PENDING':
      return { label: 'Accept', next: 'CONFIRMED' };
    case 'CONFIRMED':
      return { label: 'Start cooking', next: 'PREPARING' };
    case 'PREPARING':
      return { label: 'Mark ready', next: 'READY' };
    default:
      return null;
  }
}

function itemsSummary(items: CompletedOrder['items'], max = 4): string {
  if (items.length === 0) return '—';
  const head = items.slice(0, max).map((i) => `${i.qty}× ${i.name}`);
  const more = items.length > max ? ` +${items.length - max}` : '';
  return head.join(' · ') + more;
}

function orderTypeFilter(o: CompletedOrder, f: TypeFilter): boolean {
  if (f === 'all') return true;
  if (f === 'DINE_IN') return o.orderType === 'DINE_IN';
  return o.orderType === 'TAKEAWAY' || o.orderType === 'DELIVERY';
}

export default function KitchenScreen() {
  const insets = useSafeAreaInsets();
  const { horizontalPadding, maxContentWidth, isTablet } = useResponsive();
  const { orders, updateOrderInHistory, refreshOrders } = useApp();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const contentLayout = useMemo(
    () => (isTablet ? { maxWidth: maxContentWidth, alignSelf: 'center' as const, width: '100%' as const } : null),
    [isTablet, maxContentWidth]
  );

  const kitchenOrders = useMemo(() => {
    return orders.filter((o) => {
      const s = (o.status ?? 'PENDING') as OrderStatus;
      if (!PIPELINE.includes(s)) return false;
      return orderTypeFilter(o, typeFilter);
    });
  }, [orders, typeFilter]);

  const byColumn = useMemo(() => {
    const map: Record<OrderStatus, CompletedOrder[]> = {
      PENDING: [],
      CONFIRMED: [],
      PREPARING: [],
      READY: [],
      DELIVERED: [],
      PAID: [],
      CANCELLED: [],
    };
    for (const o of kitchenOrders) {
      const s = (o.status ?? 'PENDING') as OrderStatus;
      map[s].push(o);
    }
    for (const col of PIPELINE) {
      map[col].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }
    return map;
  }, [kitchenOrders]);

  const counts = useMemo(
    () => ({
      active: kitchenOrders.length,
      new: byColumn.PENDING.length,
      cooking: byColumn.CONFIRMED.length + byColumn.PREPARING.length,
      ready: byColumn.READY.length,
    }),
    [kitchenOrders.length, byColumn]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshOrders();
    } finally {
      setRefreshing(false);
    }
  }, [refreshOrders]);

  const advance = useCallback(
    (orderId: string, next: OrderStatus) => {
      updateOrderInHistory({ orderId, status: next }).catch(() => {});
    },
    [updateOrderInHistory]
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 24 },
          contentLayout,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.delay(40).duration(380).springify()} style={styles.hero}>
          <View style={styles.heroIconWrap}>
            <Icon name="clipboard" size={32} color={colors.primaryContrast} />
          </View>
          <Text style={styles.heroTitle}>Kitchen display</Text>
          <Text style={styles.heroSub}>
            FIFO queue · advance tickets as you cook · pull down to refresh
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(400).springify()} style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{counts.active}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statCard, styles.statCardAmber]}>
            <Text style={styles.statValue}>{counts.new}</Text>
            <Text style={styles.statLabel}>New</Text>
          </View>
          <View style={[styles.statCard, styles.statCardViolet]}>
            <Text style={styles.statValue}>{counts.cooking}</Text>
            <Text style={styles.statLabel}>In progress</Text>
          </View>
          <View style={[styles.statCard, styles.statCardGreen]}>
            <Text style={styles.statValue}>{counts.ready}</Text>
            <Text style={styles.statLabel}>Ready</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(400).springify()} style={styles.filterRow}>
          {(['all', 'DINE_IN', 'AWAY'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, typeFilter === f && styles.filterChipActive]}
              onPress={() => setTypeFilter(f)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterChipText, typeFilter === f && styles.filterChipTextActive]}>
                {f === 'all' ? 'All' : f === 'DINE_IN' ? `${ORDER_TYPE_EMOJI.DINE_IN} Dine-in` : 'Pickup / delivery'}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        <View style={isTablet ? styles.columnsTablet : styles.columnsPhone}>
          {PIPELINE.map((col, colIdx) => (
            <Animated.View
              key={col}
              entering={FadeInRight.delay(100 + colIdx * 50).duration(360).springify()}
              style={[styles.column, isTablet && styles.columnTablet]}
            >
              <View style={styles.columnHeader}>
                <View style={[styles.columnDot, { backgroundColor: STATUS_ACCENT[col] }]} />
                <View style={styles.columnHeaderText}>
                  <Text style={styles.columnTitle}>{COLUMN_LABELS[col]}</Text>
                  <Text style={styles.columnHint}>{COLUMN_HINTS[col]}</Text>
                </View>
                <View style={styles.columnBadge}>
                  <Text style={styles.columnBadgeText}>{byColumn[col].length}</Text>
                </View>
              </View>

              {byColumn[col].length === 0 ? (
                <View style={styles.emptyColumn}>
                  <Icon name="inbox" size={22} color={colors.textSubtle} />
                  <Text style={styles.emptyColumnText}>No tickets</Text>
                </View>
              ) : (
                byColumn[col].map((order, i) => (
                  <KitchenTicketCard key={order.id} order={order} index={i} onAdvance={advance} />
                ))
              )}
            </Animated.View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function KitchenTicketCard({
  order,
  index,
  onAdvance,
}: {
  order: CompletedOrder;
  index: number;
  onAdvance: (orderId: string, next: OrderStatus) => void;
}) {
  const status = (order.status ?? 'PENDING') as OrderStatus;
  const accent = STATUS_ACCENT[status];
  const step = nextKitchenStep(status);
  const typeLabel =
    order.orderType === 'DINE_IN'
      ? 'Dine-in'
      : order.orderType === 'TAKEAWAY'
        ? 'Pickup'
        : 'Delivery';

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index * 40, 200)).duration(320).springify()}
      style={[
        styles.ticket,
        { borderLeftColor: accent },
        Platform.select({
          ios: shadows.md,
          android: { elevation: 4 },
        }),
      ]}
    >
      <View style={styles.ticketTop}>
        <View>
          <Text style={styles.ticketId}>#{shortId(order.id)}</Text>
          <Text style={styles.ticketMeta}>
            {ORDER_TYPE_EMOJI[order.orderType]} {typeLabel}
            {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
            {order.customerName ? ` · ${order.customerName}` : ''}
          </Text>
        </View>
        <View style={[styles.waitPill, { borderColor: accent + '55' }]}>
          <Icon name="clock" size={14} color={accent} />
          <Text style={[styles.waitPillText, { color: accent }]}>{waitLabel(order.createdAt)}</Text>
        </View>
      </View>
      <Text style={styles.ticketItems} numberOfLines={3}>
        {itemsSummary(order.items)}
      </Text>
      {order.orderNotes ? (
        <View style={styles.notesRow}>
          <Icon name="message-circle" size={14} color={colors.textSubtle} />
          <Text style={styles.notesText} numberOfLines={2}>
            {order.orderNotes}
          </Text>
        </View>
      ) : null}
      {step ? (
        <PressableScale
          style={[styles.advanceBtn, { backgroundColor: accent }]}
          activeScale={0.97}
          onPress={() => onAdvance(order.id, step.next)}
        >
          <Text style={styles.advanceBtnText}>{step.label}</Text>
          <Icon name="chevron-right" size={18} color="#fff" />
        </PressableScale>
      ) : (
        <View style={styles.doneRow}>
          <Icon name="check-circle" size={18} color={colors.primary} />
          <Text style={styles.doneText}>Waiting for service / payment</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.dark,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    marginBottom: spacing.lg,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: {
    ...typography.h1,
    color: '#fff',
    fontSize: 24,
    marginBottom: spacing.xs,
  },
  heroSub: {
    ...typography.body,
    color: colors.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    alignItems: 'center',
  },
  statCardAmber: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statCardViolet: {
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  statCardGreen: {
    borderColor: 'rgba(5, 150, 105, 0.35)',
  },
  statValue: {
    ...typography.h2,
    color: '#fff',
    fontSize: 20,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  filterChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.darkCard,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  filterChipActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.2)',
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.bodyMedium,
    color: colors.textSubtle,
    fontSize: 13,
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  columnsPhone: {
    gap: spacing.lg,
  },
  columnsTablet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  column: {
    gap: spacing.sm,
  },
  columnTablet: {
    flex: 1,
    minWidth: 0,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  columnDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  columnHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  columnTitle: {
    ...typography.bodySemibold,
    color: '#fff',
    fontSize: 15,
  },
  columnHint: {
    ...typography.caption,
    color: colors.textSubtle,
    fontSize: 11,
  },
  columnBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  columnBadgeText: {
    ...typography.bodySemibold,
    color: '#fff',
    fontSize: 13,
  },
  emptyColumn: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.darkBorder,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  emptyColumnText: {
    ...typography.caption,
    color: colors.textSubtle,
  },
  ticket: {
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },
  ticketTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  ticketId: {
    ...typography.bodySemibold,
    color: '#fff',
    fontSize: 16,
  },
  ticketMeta: {
    ...typography.caption,
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
    maxWidth: 220,
  },
  waitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  waitPillText: {
    ...typography.caption,
    fontSize: 12,
    fontWeight: '700',
  },
  ticketItems: {
    ...typography.body,
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  notesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: spacing.sm,
  },
  notesText: {
    flex: 1,
    ...typography.caption,
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  advanceBtnText: {
    ...typography.bodySemibold,
    color: '#fff',
    fontSize: 15,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
  },
  doneText: {
    ...typography.caption,
    color: colors.textSubtle,
    fontSize: 13,
  },
});
