import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '../hooks/useResponsive';
import Animated, {
  FadeIn,
  FadeInDown,
  Layout,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { useAuth } from '../hooks/useAuth';
import { colors, spacing, radius, typography, shadows } from '../theme';
import { EmptyState } from '../components/ui';
import type {
  CompletedOrder,
  CompletedOrderItem,
  PaymentMethod,
  OrderType,
  OrderStatus,
} from '../types/pos';
import { DEMO_FOOD_ITEMS } from '../constants/demoData';
import type { FoodItem } from '../constants/demoData';
import { ORDER_TYPE_EMOJI, PAYMENT_EMOJI, FEATHER_ICONS } from '../constants/appIcons';
import { InvoiceButton } from '../components/InvoiceButton';
import { ReceiptPreview } from '../components/ReceiptPreview';
import { buildInvoiceFromOrder, invoiceTableFieldsForOrder } from '../services/printerService';
import { storeConfig } from '../constants/storeConfig';

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  MOBILE: 'Mobile',
  CARD: 'Card',
  CASH: 'Cash',
};

const ALL_PAYMENT_METHODS: PaymentMethod[] = ['MOBILE', 'CARD', 'CASH'];
const ENABLED_PAYMENT_METHODS: PaymentMethod[] = storeConfig.enabledPaymentMethods ?? ['CASH'];

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  DINE_IN: 'Dine In',
  TAKEAWAY: 'Pick Up',
  DELIVERY: 'Delivery',
};

/** Statuses user can set when editing (includes Cancel) */
const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'DELIVERED',
  'PAID',
  'CANCELLED',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PREPARING: 'Preparing',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
};

type DateRange = 'all' | 'today' | 'week';
type FilterPayment = 'all' | 'unpaid' | 'paid';
type FilterOrderType = 'all' | OrderType;
type FilterStatus = 'all' | OrderStatus;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function shortId(id: string): string {
  if (id.startsWith('ORD')) return id;
  const parts = id.split('_');
  return parts.length > 1 ? parts[parts.length - 1] : id.slice(-6);
}

function itemsPreview(items: { name: string; qty: number }[], max = 2): string {
  if (items.length === 0) return 'No items';
  const head = items.slice(0, max).map((i) => `${i.qty}× ${i.name}`).join(', ');
  return items.length > max ? `${head} +${items.length - max} more` : head;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#0ea5e9',
  PREPARING: '#8b5cf6',
  READY: '#10b981',
  DELIVERED: '#64748b',
  PAID: '#059669',
  CANCELLED: '#ef4444',
};

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMins = Math.floor((now.getTime() - d.getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const ACCENT = colors.primary;
const ACCENT_LIGHT = colors.primaryLight;

function filterByDateRange(orders: CompletedOrder[], range: DateRange): CompletedOrder[] {
  if (range === 'all') return orders;
  const now = new Date();
  if (range === 'today') {
    return orders.filter((o) => new Date(o.createdAt).toDateString() === now.toDateString());
  }
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return orders.filter((o) => new Date(o.createdAt) >= weekAgo);
}

function applyFilters(
  orders: CompletedOrder[],
  payment: FilterPayment,
  orderType: FilterOrderType,
  status: FilterStatus
): CompletedOrder[] {
  return orders.filter((o) => {
    const s = (o.status ?? 'PENDING') as OrderStatus;
    if (status === 'CANCELLED') {
      if (s !== 'CANCELLED') return false;
      if (orderType !== 'all' && o.orderType !== orderType) return false;
      return true;
    }
    if (s === 'CANCELLED') return false;
    if (payment === 'unpaid' && s === 'PAID') return false;
    if (payment === 'paid' && s !== 'PAID') return false;
    if (orderType !== 'all' && o.orderType !== orderType) return false;
    if (status !== 'all' && s !== status) return false;
    return true;
  });
}

const OrderCard = React.memo(function OrderCard({
  order,
  index,
  onPress,
}: {
  order: CompletedOrder;
  index: number;
  onPress: () => void;
}) {
  const status = (order.status ?? 'PENDING') as OrderStatus;
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod];
  const paymentEmoji = PAYMENT_EMOJI[order.paymentMethod] ?? '💳';
  const orderTypeLabel = ORDER_TYPE_LABELS[order.orderType];
  const orderTypeEmoji = ORDER_TYPE_EMOJI[order.orderType] ?? '🍽️';
  const statusColor = STATUS_COLORS[status];
  const itemLines = order.items.map((i) => ({ name: i.name, qty: i.qty }));
  const totalItems = order.items.reduce((s, i) => s + i.qty, 0);
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={styles.orderCardTouch}
    >
      <Animated.View
        entering={FadeInDown.delay(index * 40).duration(300).springify()}
        style={[styles.orderCard, { borderLeftColor: statusColor }]}
      >
        <View style={styles.orderCardTop}>
          <View style={styles.orderCardIdRow}>
            <Text style={styles.orderId}>#{shortId(order.id)}</Text>
            <Text style={styles.orderTimeAgo}>{formatRelative(order.createdAt)}</Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusChipText, { color: statusColor }]}>{STATUS_LABELS[status]}</Text>
          </View>
        </View>
        <View style={styles.orderCardMeta}>
          <View style={styles.orderTypeBadge}>
            <Text style={styles.orderTypeEmoji} allowFontScaling={false}>{orderTypeEmoji}</Text>
            <Text style={styles.orderTypeBadgeText}>
              {orderTypeLabel}
              {order.tableNumber ? ` · T-${order.tableNumber}` : ''}
            </Text>
          </View>
          <Text style={styles.orderItemsPreview} numberOfLines={2}>
            {itemsPreview(itemLines, 3)}
          </Text>
          <Text style={styles.orderItemCountLabel}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.orderCardBottom}>
          <View style={styles.paymentChip}>
            <Text style={styles.paymentEmoji} allowFontScaling={false}>{paymentEmoji}</Text>
            <Text style={styles.paymentChipText}>{paymentLabel}</Text>
          </View>
          <View style={styles.orderCardTotalRow}>
            <Text style={styles.orderTotal}>${order.total.toFixed(2)}</Text>
            <Icon name={FEATHER_ICONS.chevronRight} size={20} color="#94a3b8" />
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

function PaymentLoaderCard() {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1
    );
    scale.value = withRepeat(
      withTiming(1.08, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(rotation);
      cancelAnimation(scale);
    };
  }, [rotation, scale]);
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <View style={styles.loaderCard}>
      <View style={styles.loaderIconWrap}>
        <Animated.View style={[styles.loaderRing, ringStyle]} />
        <Animated.View style={[styles.loaderIconInner, iconStyle]}>
          <Icon name="file-text" size={40} color={colors.primary} />
        </Animated.View>
      </View>
      <Text style={styles.loaderTitle}>Generating invoice</Text>
      <Text style={styles.loaderSubtitle}>Please wait a moment...</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: 'clipboard' | 'clock' | 'check-circle';
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIconWrap}>
        <Icon name={icon} size={22} color={ACCENT} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function OrdersScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { auth } = useAuth();
  const {
    orders: orderHistory,
    updateOrderInHistory,
    addItemsToOrder,
    refreshOrders,
  } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const authUser = auth.user;
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [filterPayment, setFilterPayment] = useState<FilterPayment>('all');
  const [filterOrderType, setFilterOrderType] = useState<FilterOrderType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [editingOrder, setEditingOrder] = useState<CompletedOrder | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatus>('CONFIRMED');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('MOBILE');
  const [orderForPayment, setOrderForPayment] = useState<CompletedOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('0.00');
  const [paymentMethodForPay, setPaymentMethodForPay] = useState<PaymentMethod>('MOBILE');
  const [invoiceOrder, setInvoiceOrder] = useState<CompletedOrder | null>(null);
  const [invoicePaymentMethod, setInvoicePaymentMethod] = useState<PaymentMethod | null>(null);
  const [showPaymentLoader, setShowPaymentLoader] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<CompletedOrder | null>(null);
  const [updateOrderCart, setUpdateOrderCart] = useState<{ food: FoodItem; qty: number }[]>([]);
  const [showAddItemDropdown, setShowAddItemDropdown] = useState(false);
  const { horizontalPadding, maxContentWidth, isTablet } = useResponsive();

  useFocusEffect(
    useCallback(() => {
      refreshOrders().catch(() => {});
    }, [refreshOrders])
  );

  const editingOrderId = editingOrder?.id;
  useEffect(() => {
    if (editingOrderId == null) return;
    if (!orderHistory.some((o) => o.id === editingOrderId)) {
      setEditingOrder(null);
    }
  }, [orderHistory, editingOrderId]);

  const orderForPaymentId = orderForPayment?.id;
  useEffect(() => {
    if (orderForPaymentId == null) return;
    if (!orderHistory.some((o) => o.id === orderForPaymentId)) {
      setOrderForPayment(null);
      setPaymentAmount('0.00');
    }
  }, [orderHistory, orderForPaymentId]);

  const ordersByDate = useMemo(
    () => filterByDateRange(orderHistory, dateRange),
    [orderHistory, dateRange]
  );

  const ordersExcludingCancelled = useMemo(
    () => ordersByDate.filter((o) => (o.status ?? 'PENDING') !== 'CANCELLED'),
    [ordersByDate]
  );

  const filteredOrders = useMemo(
    () => applyFilters(ordersByDate, filterPayment, filterOrderType, filterStatus),
    [ordersByDate, filterPayment, filterOrderType, filterStatus]
  );

  const invoicePayload = useMemo(() => {
    if (!invoiceOrder) return null;
    const { tableNumber, tableDisplay } = invoiceTableFieldsForOrder({
      orderType: invoiceOrder.orderType,
      tableNumber: invoiceOrder.tableNumber,
    });
    return buildInvoiceFromOrder({
      orderId: invoiceOrder.id,
      createdAt: invoiceOrder.createdAt,
      storeName: storeConfig.storeName,
      storeAddress: storeConfig.storeAddress,
      storePhone: storeConfig.storePhone,
      storeWebsite: storeConfig.storeWebsite,
      binTax: storeConfig.binTax,
      servedBy: authUser?.name ?? 'Admin',
      tableNumber,
      tableDisplay,
      orderTypeLabel: ORDER_TYPE_LABELS[invoiceOrder.orderType],
      items: invoiceOrder.items.map((i) => ({ name: i.name, price: i.price, qty: i.qty })),
      total: invoiceOrder.total,
      customerName: invoiceOrder.customerName ?? '',
      orderNotes: invoiceOrder.orderNotes ?? '',
      serviceChargeAmount: storeConfig.defaultServiceChargeAmount ?? 2,
      // vatAmount: set from API when available (e.g. order.vatAmount or settings)
      paymentMethod: PAYMENT_LABELS[invoicePaymentMethod ?? invoiceOrder.paymentMethod],
      paidAmount: invoiceOrder.total,
      poweredByName: storeConfig.poweredByName,
      poweredBy: storeConfig.poweredBy,
    });
  }, [invoiceOrder, invoicePaymentMethod, authUser?.name]);

  const ordersForList = useMemo(() => {
    const STATUS_SORT_ORDER: Record<OrderStatus, number> = {
      PENDING: 0,
      CONFIRMED: 1,
      PREPARING: 2,
      READY: 3,
      DELIVERED: 4,
      PAID: 5,
      CANCELLED: 6,
    };
    return [...filteredOrders].sort((a, b) => {
      const statusA = (a.status ?? 'PENDING') as OrderStatus;
      const statusB = (b.status ?? 'PENDING') as OrderStatus;
      const byStatus = STATUS_SORT_ORDER[statusA] - STATUS_SORT_ORDER[statusB];
      if (byStatus !== 0) return byStatus;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [filteredOrders]);

  /** Same pipeline as the list (date range, exclude cancelled) — do not use `total_orders` snapshot here; observe can lag or deserialize wrong while `orders` is correct. */
  const stats = useMemo(() => {
    const total = ordersExcludingCancelled.length;
    const unpaid = ordersExcludingCancelled.filter((o) => (o.status ?? 'PENDING') !== 'PAID').length;
    const paid = ordersExcludingCancelled.filter((o) => (o.status ?? 'PENDING') === 'PAID').length;
    return { total, unpaid, paid };
  }, [ordersExcludingCancelled]);

  const openEdit = useCallback((order: CompletedOrder) => {
    setEditingOrder(order);
    setEditStatus((order.status ?? 'PENDING') as OrderStatus);
    const allowed: PaymentMethod[] = ENABLED_PAYMENT_METHODS.length > 0 ? ENABLED_PAYMENT_METHODS : ['CASH'];
    const method = allowed.includes(order.paymentMethod) ? order.paymentMethod : allowed[0];
    setEditPayment(method);
  }, []);

  const openReprint = useCallback((order: CompletedOrder) => {
    setEditingOrder(null);
    setInvoiceOrder(order);
    setInvoicePaymentMethod(order.paymentMethod);
  }, []);

  const saveEdit = async () => {
    if (!editingOrder) return;
    await updateOrderInHistory({
      orderId: editingOrder.id,
      status: editStatus,
      paymentMethod: editPayment,
    });
    setEditingOrder(null);
  };

  const openPaymentModal = (order: CompletedOrder) => {
    setOrderForPayment(order);
    setPaymentAmount('0.00');
    const allowed: PaymentMethod[] = ENABLED_PAYMENT_METHODS.length > 0 ? ENABLED_PAYMENT_METHODS : ['CASH'];
    const method = allowed.includes(order.paymentMethod) ? order.paymentMethod : allowed[0];
    setPaymentMethodForPay(method);
    setEditingOrder(null);
  };

  const openUpdateOrder = (order: CompletedOrder) => {
    setOrderToUpdate(order);
    setUpdateOrderCart([]);
    setEditingOrder(null);
  };

  const closeUpdateOrderModal = () => {
    setOrderToUpdate(null);
    setUpdateOrderCart([]);
    setShowAddItemDropdown(false);
  };

  const orderToUpdateId = orderToUpdate?.id;
  useEffect(() => {
    if (orderToUpdateId == null) return;
    if (!orderHistory.some((o) => o.id === orderToUpdateId)) {
      setOrderToUpdate(null);
      setUpdateOrderCart([]);
      setShowAddItemDropdown(false);
    }
  }, [orderHistory, orderToUpdateId]);

  const addToUpdateCart = (food: FoodItem, qty: number = 1) => {
    setUpdateOrderCart((prev) => {
      const existing = prev.find((c) => c.food.id === food.id);
      if (existing) {
        return prev.map((c) =>
          c.food.id === food.id ? { ...c, qty: c.qty + qty } : c
        );
      }
      return [...prev, { food, qty }];
    });
  };

  const removeFromUpdateCart = (foodId: string) => {
    setUpdateOrderCart((prev) => prev.filter((c) => c.food.id !== foodId));
  };

  const confirmAddToOrder = () => {
    if (!orderToUpdate || updateOrderCart.length === 0) return;
    const ts = Date.now();
    const newItems: CompletedOrderItem[] = updateOrderCart.map((c, i) => ({
      id: `add_${c.food.id}_${ts}_${i}`,
      name: c.food.item_name,
      price: c.food.price,
      qty: c.qty,
    }));
    addItemsToOrder({ orderId: orderToUpdate.id, newItems });
    setOrderToUpdate(null);
    setUpdateOrderCart([]);
    setShowAddItemDropdown(false);
  };

  const dueAmount = orderForPayment?.total ?? 0;
  const paymentAmountNum = parseFloat(paymentAmount) || 0;
  const canCompletePayment = paymentAmountNum >= dueAmount && dueAmount > 0;

  const handleOrderPress = useCallback(
    (order: CompletedOrder) => {
      (order.status ?? 'PENDING') === 'PAID' ? openReprint(order) : openEdit(order);
    },
    [openReprint, openEdit]
  );

  const appendPaymentAmount = (char: string) => {
    if (char === '.') {
      if (paymentAmount.includes('.')) return;
      setPaymentAmount((prev) => (prev === '0.00' || prev === '0' ? '0.' : prev + '.'));
      return;
    }
    setPaymentAmount((prev) => {
      if (prev === '0.00' || prev === '0') return char;
      const next = prev + char;
      const [a, b] = next.split('.');
      const dec = b?.slice(0, 2) ?? '';
      return b !== undefined ? `${a || '0'}.${dec}` : next;
    });
  };

  const backspacePaymentAmount = () => {
    setPaymentAmount((prev) => {
      if (prev.length <= 1) return '0.00';
      const next = prev.slice(0, -1);
      return next === '' || next === '0.' ? '0.00' : next;
    });
  };

  const setPaymentToTotal = () => {
    setPaymentAmount(dueAmount.toFixed(2));
  };

  const completePayment = () => {
    if (!orderForPayment || !canCompletePayment) return;
    const order = orderForPayment;
    const method = paymentMethodForPay;
    setOrderForPayment(null);
    setPaymentAmount('0.00');
    setShowPaymentLoader(true);

    requestAnimationFrame(() => {
      setTimeout(() => {
        updateOrderInHistory({
          orderId: order.id,
          status: 'PAID',
          paymentMethod: method,
        })
          .catch(() => {})
          .finally(() => {
            setInvoiceOrder({ ...order, status: 'PAID', paymentMethod: method });
            setInvoicePaymentMethod(method);
            setShowPaymentLoader(false);
          });
      }, 0);
    });
  };

  const closeInvoiceModal = () => {
    setInvoiceOrder(null);
    setInvoicePaymentMethod(null);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshOrders().finally(() => setRefreshing(false));
  }, [refreshOrders]);

  return (
    <View style={[styles.container, isTablet && { alignItems: 'center' }]}>
      <ScrollView
        style={[styles.scroll, isTablet && { width: '100%', maxWidth: maxContentWidth }]}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: horizontalPadding }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        <Animated.View entering={FadeIn.duration(300)} style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Orders</Text>
          <Text style={styles.pageSubtitle}>
            {dateRange === 'today' ? "Today's" : dateRange === 'week' ? 'Last 7 days' : 'All time'} · {ordersForList.length} order{ordersForList.length !== 1 ? 's' : ''}
          </Text>
        </Animated.View>

        {/* Stats from in-memory orders (date range, excl. cancelled) — matches list source */}
        <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.statsRow}>
          <StatCard label="Orders" value={stats.total} icon="clipboard" />
          <StatCard label="Unpaid" value={stats.unpaid} icon="clock" />
          <StatCard label="Paid" value={stats.paid} icon="check-circle" />
        </Animated.View>

        {/* Filters card — collapsible */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.filterCard}>
          <TouchableOpacity
            style={styles.filterCardHeader}
            onPress={() => setFilterCollapsed((c) => !c)}
            activeOpacity={0.7}
          >
            <Icon name={FEATHER_ICONS.filter} size={18} color="#475569" />
            <Text style={styles.filterCardTitle}>Filters</Text>
            <Text style={styles.filterCardSummary} numberOfLines={1}>
              {dateRange === 'all' ? 'All time' : dateRange === 'today' ? 'Today' : '7 days'}
              {(filterPayment !== 'all' || filterOrderType !== 'all' || filterStatus !== 'all') && (
                <> · {filterPayment !== 'all' ? (filterPayment === 'unpaid' ? 'Unpaid' : 'Paid') : filterOrderType !== 'all' ? ORDER_TYPE_LABELS[filterOrderType] : filterStatus === 'all' ? 'All' : STATUS_LABELS[filterStatus]}</>
              )}
              {' · '}{ordersForList.length} orders
            </Text>
            {(filterPayment !== 'all' || filterOrderType !== 'all' || filterStatus !== 'all') && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setFilterPayment('all');
                  setFilterOrderType('all');
                  setFilterStatus('all');
                }}
                style={styles.filterClearBtn}
              >
                <Text style={styles.filterClearBtnText}>Clear</Text>
              </TouchableOpacity>
            )}
            <Icon
              name={filterCollapsed ? FEATHER_ICONS.chevronDown : FEATHER_ICONS.chevronUp}
              size={22}
              color="#64748b"
            />
          </TouchableOpacity>

          {!filterCollapsed && (
            <Animated.View layout={Layout.springify().damping(20).stiffness(200)}>
              <View style={styles.filterCollapsedDivider} />
              <Text style={styles.filterLabel}>Time</Text>
              <View style={styles.filterSegmented}>
                {(['all', 'today', 'week'] as const).map((range) => (
                  <TouchableOpacity
                    key={range}
                    style={[styles.filterChip, dateRange === range && styles.filterChipActive]}
                    onPress={() => setDateRange(range)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterChipText, dateRange === range && styles.filterChipTextActive]}>
                      {range === 'all' ? 'All' : range === 'today' ? 'Today' : '7 days'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Payment</Text>
              <View style={styles.filterChipRow}>
                {(['all', 'unpaid', 'paid'] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.filterPill, filterPayment === p && styles.filterPillActive]}
                    onPress={() => setFilterPayment(p)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, filterPayment === p && styles.filterPillTextActive]}>
                      {p === 'all' ? 'All' : p === 'unpaid' ? 'Unpaid' : 'Paid'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Order type</Text>
              <View style={styles.filterChipRow}>
                {(['all', 'DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterPill, filterOrderType === t && styles.filterPillActive]}
                    onPress={() => setFilterOrderType(t)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterPillText, filterOrderType === t && styles.filterPillTextActive]}>
                      {t === 'all' ? 'All' : `${ORDER_TYPE_EMOJI[t]} ${ORDER_TYPE_LABELS[t]}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.filterLabel}>Status</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterStatusScroll}
              >
                {(['all', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'PAID', 'CANCELLED'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterStatusPill, filterStatus === s && styles.filterStatusPillActive]}
                    onPress={() => setFilterStatus(s)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.filterStatusDot, s !== 'all' && { backgroundColor: STATUS_COLORS[s] }]} />
                    <Text style={[styles.filterStatusPillText, filterStatus === s && styles.filterStatusPillTextActive]}>
                      {s === 'all' ? 'All' : STATUS_LABELS[s]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.filterResultHint}>
                <Text style={styles.filterResultHintText}>
                  {filterStatus === 'CANCELLED'
                    ? `Showing ${ordersForList.length} cancelled order${ordersForList.length !== 1 ? 's' : ''}`
                    : `Showing ${ordersForList.length} order${ordersForList.length !== 1 ? 's' : ''} (newest first within status)`}
                </Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        <Animated.View entering={FadeIn.delay(140).duration(300)} style={styles.listHeader}>
          <Text style={styles.listTitle}>Order list</Text>
          <Text style={styles.listSubtitle}>
            Tap an order to update status, add items or collect payment
          </Text>
        </Animated.View>

        {ordersForList.length === 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
            <EmptyState
              icon={<Icon name="inbox" size={48} color={colors.textSubtle} />}
              title="No orders in this period"
              subtitle="Change the filter above or create a new order from the POS."
              action={
                <TouchableOpacity
                  style={styles.cta}
                  onPress={() => navigation.navigate('POS' as never)}
                  activeOpacity={0.85}
                >
                  <Icon name="plus" size={20} color="#fff" />
                  <Text style={styles.ctaText}>New order</Text>
                </TouchableOpacity>
              }
            />
          </Animated.View>
        ) : (
          <>
            {ordersForList.map((order, index) => (
              <OrderCard
                key={order.id}
                order={order}
                index={index}
                onPress={() => handleOrderPress(order)}
              />
            ))}
            <Modal
              visible={editingOrder !== null}
              transparent
              animationType="slide"
              onRequestClose={() => setEditingOrder(null)}
            >
              <View style={styles.editOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingOrder(null)} />
                <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.editCard}>
                  <View style={styles.editHeader}>
                    <Text style={styles.editTitle}>Change status & payment</Text>
                    <TouchableOpacity onPress={() => setEditingOrder(null)} hitSlop={12}>
                      <Icon name="x" size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  {editingOrder && (
                    <>
                      <Text style={styles.editOrderSummary}>
                        {formatDate(editingOrder.createdAt)} • ${editingOrder.total.toFixed(2)}
                      </Text>
                      <Text style={styles.editSectionLabel}>Status</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.editChipsScroll}>
                        {STATUS_OPTIONS.map((s) => (
                          <TouchableOpacity
                            key={s}
                            style={[styles.editChip, editStatus === s && styles.editChipActive]}
                            onPress={() => setEditStatus(s)}
                          >
                            <Text style={[styles.editChipText, editStatus === s && styles.editChipTextActive]}>
                              {STATUS_LABELS[s]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      {(editingOrder.status ?? 'PENDING') !== 'PAID' && (
                        <TouchableOpacity
                          style={styles.collectPaymentBtn}
                          onPress={() => openPaymentModal(editingOrder)}
                        >
                          <Icon name="dollar-sign" size={20} color="#fff" />
                          <Text style={styles.collectPaymentBtnText}>Collect payment</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.updateOrderBtn}
                        onPress={() => openUpdateOrder(editingOrder)}
                      >
                        <Icon name="plus-circle" size={20} color="#0ea5e9" />
                        <Text style={styles.updateOrderBtnText}>Update order (add items)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.saveEditBtn} onPress={saveEdit}>
                        <Icon name="check" size={20} color="#fff" />
                        <Text style={styles.saveEditBtnText}>Save</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Animated.View>
              </View>
            </Modal>

            {/* Payment modal — amount keypad like web */}
            <Modal
              visible={orderForPayment !== null}
              transparent
              animationType="slide"
              onRequestClose={() => setOrderForPayment(null)}
            >
              <View style={styles.editOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setOrderForPayment(null)} />
                <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.paymentCard}>
                  <View style={styles.editHeader}>
                    <Text style={styles.editTitle}>Payment</Text>
                    <TouchableOpacity onPress={() => setOrderForPayment(null)} hitSlop={12}>
                      <Icon name="x" size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  {orderForPayment && (
                    <ScrollView
                      style={styles.paymentCardScroll}
                      contentContainerStyle={styles.paymentCardScrollContent}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.paymentOrderId}>Order #{shortId(orderForPayment.id)}</Text>
                      <View style={styles.paymentDueRow}>
                        <Text style={styles.paymentDueLabel}>Due amount</Text>
                        <Text style={styles.paymentDueValue}>${dueAmount.toFixed(2)}</Text>
                      </View>
                      <Text style={styles.editSectionLabel}>Amount received</Text>
                      <View style={styles.paymentAmountWrap}>
                        <Text style={styles.paymentAmountText}>${paymentAmount}</Text>
                        <TouchableOpacity style={styles.payFullBtn} onPress={setPaymentToTotal}>
                          <Text style={styles.payFullBtnText}>Pay full amount</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.keypadRow}>
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                          <TouchableOpacity
                            key={key}
                            style={styles.keypadKey}
                            onPress={() => (key === '⌫' ? backspacePaymentAmount() : appendPaymentAmount(key))}
                          >
                            <Text style={styles.keypadKeyText}>{key}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <Text style={styles.editSectionLabel}>Payment method</Text>
                      <View style={styles.editPaymentRow}>
                        {ALL_PAYMENT_METHODS.map((pm) => {
                          const enabled = ENABLED_PAYMENT_METHODS.includes(pm);
                          return (
                            <TouchableOpacity
                              key={pm}
                              style={[
                                styles.editPaymentChip,
                                paymentMethodForPay === pm && styles.editPaymentChipActive,
                                !enabled && styles.editPaymentChipDisabled,
                              ]}
                              onPress={() => enabled && setPaymentMethodForPay(pm)}
                              disabled={!enabled}
                              activeOpacity={enabled ? 0.7 : 1}
                            >
                              <Text style={styles.editPaymentEmoji} allowFontScaling={false}>{PAYMENT_EMOJI[pm]}</Text>
                              <Text style={[
                                styles.editPaymentChipText,
                                paymentMethodForPay === pm && styles.editPaymentChipTextActive,
                                !enabled && styles.editPaymentChipTextDisabled,
                              ]}>
                                {PAYMENT_LABELS[pm]}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <TouchableOpacity
                        style={[styles.completePaymentBtn, !canCompletePayment && styles.completePaymentBtnDisabled]}
                        onPress={completePayment}
                        disabled={!canCompletePayment}
                      >
                        <Icon name={FEATHER_ICONS.checkCircle} size={22} color="#fff" />
                        <Text style={styles.completePaymentBtnText}>Complete payment</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  )}
                </Animated.View>
              </View>
            </Modal>

            {/* Update order — add items only (existing items unchanged) */}
            <Modal
              visible={orderToUpdate !== null}
              transparent
              animationType="slide"
              onRequestClose={closeUpdateOrderModal}
            >
              <View style={styles.editOverlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={closeUpdateOrderModal} />
                <Animated.View entering={FadeInDown.duration(280).springify()} style={styles.updateOrderCard}>
                  <View style={styles.editHeader}>
                    <Text style={styles.editTitle}>Update order</Text>
                    <TouchableOpacity onPress={closeUpdateOrderModal} hitSlop={12}>
                      <Icon name="x" size={24} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                  {orderToUpdate && (
                    <>
                      <Text style={styles.updateOrderId}>Order #{shortId(orderToUpdate.id)} · Add items only</Text>
                      <Text style={styles.editSectionLabel}>Current items (unchanged)</Text>
                      <View style={styles.updateOrderCurrentList}>
                        {orderToUpdate.items.map((item) => (
                          <View key={item.id} style={styles.updateOrderCurrentRow}>
                            <Text style={styles.updateOrderCurrentText} numberOfLines={1}>
                              {item.qty}× {item.name}
                            </Text>
                            <Text style={styles.updateOrderCurrentTotal}>
                              ${(item.price * item.qty).toFixed(2)}
                            </Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.editSectionLabel}>Items to add</Text>
                      {updateOrderCart.length === 0 ? (
                        <Text style={styles.updateOrderHint}>Press "Add new" to open the list and select a food item</Text>
                      ) : (
                        <View style={styles.updateOrderAddList}>
                          {updateOrderCart.map((c) => (
                            <View key={c.food.id} style={styles.updateOrderAddRow}>
                              <Text style={styles.updateOrderAddName} numberOfLines={1}>
                                {c.qty}× {c.food.item_name}
                              </Text>
                              <View style={styles.updateOrderAddQtyRow}>
                                <TouchableOpacity
                                  onPress={() => {
                                    if (c.qty <= 1) removeFromUpdateCart(c.food.id);
                                    else
                                      setUpdateOrderCart((prev) =>
                                        prev.map((x) =>
                                          x.food.id === c.food.id ? { ...x, qty: x.qty - 1 } : x
                                        )
                                      );
                                  }}
                                  style={styles.updateOrderQtyBtn}
                                >
                                  <Icon name="minus" size={16} color="#64748b" />
                                </TouchableOpacity>
                                <Text style={styles.updateOrderQtyText}>{c.qty}</Text>
                                <TouchableOpacity
                                  onPress={() => addToUpdateCart(c.food, 1)}
                                  style={styles.updateOrderQtyBtn}
                                >
                                  <Icon name="plus" size={16} color="#0ea5e9" />
                                </TouchableOpacity>
                              </View>
                              <Text style={styles.updateOrderAddTotal}>
                                ${(c.food.price * c.qty).toFixed(2)}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <Text style={styles.editSectionLabel}>Add product</Text>
                      <TouchableOpacity
                        style={styles.addNewDropdownTrigger}
                        onPress={() => setShowAddItemDropdown((v) => !v)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addNewDropdownTriggerText}>
                          {showAddItemDropdown ? 'Hide food list' : 'Add new'}
                        </Text>
                        <Icon
                          name={showAddItemDropdown ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#0ea5e9"
                        />
                      </TouchableOpacity>
                      {showAddItemDropdown && (
                        <View style={styles.addNewDropdownList}>
                          <ScrollView
                            style={styles.addNewDropdownScroll}
                            showsVerticalScrollIndicator={true}
                            keyboardShouldPersistTaps="handled"
                          >
                            {DEMO_FOOD_ITEMS.filter((f) => f.status).map((food) => (
                              <TouchableOpacity
                                key={food.id}
                                style={styles.addNewDropdownRow}
                                onPress={() => {
                                  addToUpdateCart(food, 1);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.addNewDropdownRowName} numberOfLines={1}>
                                  {food.item_name}
                                </Text>
                                <Text style={styles.addNewDropdownRowPrice}>${food.price.toFixed(2)}</Text>
                                <Icon name="plus" size={18} color="#0ea5e9" />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                          <TouchableOpacity
                            style={styles.addNewDropdownDoneBtn}
                            onPress={() => setShowAddItemDropdown(false)}
                          >
                            <Text style={styles.addNewDropdownDoneBtnText}>Done</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                      <TouchableOpacity
                        style={[styles.addToOrderConfirmBtn, updateOrderCart.length === 0 && styles.addToOrderConfirmBtnDisabled]}
                        onPress={confirmAddToOrder}
                        disabled={updateOrderCart.length === 0}
                      >
                        <Icon name="check" size={20} color="#fff" />
                        <Text style={styles.addToOrderConfirmBtnText}>
                          Add {updateOrderCart.length > 0 ? updateOrderCart.reduce((s, c) => s + c.qty, 0) : 0} item(s) to order
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </Animated.View>
              </View>
            </Modal>

            {/* Loader + Invoice: one modal — loader first, then content switches to invoice (no stacking) */}
            <Modal
              visible={showPaymentLoader || invoiceOrder !== null}
              animationType="slide"
              onRequestClose={() => {
                if (showPaymentLoader) return;
                closeInvoiceModal();
              }}
              statusBarTranslucent
            >
              {showPaymentLoader ? (
                <View style={styles.loaderOverlay}>
                  <PaymentLoaderCard />
                </View>
              ) : invoiceOrder !== null ? (
                <View style={styles.invoiceContainer}>
                  <View
                    style={[
                      styles.invoiceHeader,
                      { paddingTop: Math.max(insets.top, spacing.sm) + spacing.xs },
                    ]}
                  >
                    <Text style={styles.invoiceTitle}>Invoice</Text>
                    <View style={styles.invoiceHeaderActions}>
                      {invoicePayload && (
                        <InvoiceButton
                          invoice={invoicePayload}
                          label="Print"
                          style={styles.invoicePrintBtn}
                          textStyle={styles.invoicePrintBtnText}
                        />
                      )}
                      <TouchableOpacity onPress={closeInvoiceModal} style={styles.invoiceDoneBtn}>
                        <Text style={styles.invoiceDoneBtnText}>Done</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {invoicePayload && (
                    <View style={styles.invoiceScroll}>
                      <ReceiptPreview payload={invoicePayload} />
                    </View>
                  )}
                </View>
              ) : null}
            </Modal>
            <TouchableOpacity
              style={styles.ctaSmall}
              onPress={() => navigation.navigate('POS' as never)}
              activeOpacity={0.85}
            >
              <Icon name="plus" size={20} color="#fff" />
              <Text style={styles.ctaSmallText}>New order</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  pageHeader: {
    marginBottom: spacing.lg,
  },
  pageTitle: {
    ...typography.display,
    fontSize: 24,
    color: colors.text,
  },
  pageSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.captionMuted,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  statValue: {
    ...typography.total,
    fontSize: 20,
    color: colors.text,
  },
  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  filterCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  filterCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  filterCardSummary: {
    flex: 1,
    fontSize: 13,
    color: '#64748b',
    marginLeft: 4,
  },
  filterCollapsedDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginTop: 16,
    marginBottom: 16,
  },
  filterClearBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterClearBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterSegmented: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: '#fff',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#0f172a',
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  filterPillActive: {
    backgroundColor: ACCENT_LIGHT,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  filterPillTextActive: {
    color: ACCENT,
  },
  filterStatusScroll: {
    paddingBottom: 4,
    paddingRight: 8,
    marginBottom: 16,
  },
  filterStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  filterStatusPillActive: {
    backgroundColor: ACCENT_LIGHT,
  },
  filterStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94a3b8',
  },
  filterStatusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterStatusPillTextActive: {
    color: '#0f172a',
  },
  filterResultHint: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  filterResultHintText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  listHeader: {
    marginBottom: spacing.md,
  },
  listTitle: {
    ...typography.h1,
    fontSize: 19,
    color: colors.text,
  },
  listSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xxs,
  },
  orderCardTouch: {
    marginBottom: spacing.sm,
  },
  orderCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  orderCardIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    fontVariant: ['tabular-nums'],
  },
  orderTimeAgo: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderCardMeta: {
    marginBottom: 14,
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  orderTypeBadgeText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  orderTypeEmoji: {
    fontSize: 16,
    textAlign: 'center',
  },
  orderItemsPreview: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 4,
  },
  orderItemCountLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  orderCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  orderCardTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: -0.3,
  },
  paymentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 10,
  },
  paymentEmoji: {
    fontSize: 16,
    textAlign: 'center',
  },
  paymentChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT,
  },
  editOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  editCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  editOrderSummary: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
  },
  editSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  editChipsScroll: {
    marginBottom: 16,
    marginHorizontal: -4,
  },
  editChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  editChipActive: {
    backgroundColor: '#0ea5e9',
  },
  editChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  editChipTextActive: {
    color: '#fff',
  },
  editPaymentRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  editPaymentChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
  },
  editPaymentChipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  editPaymentChipDisabled: {
    opacity: 0.5,
    backgroundColor: '#f1f5f9',
  },
  editPaymentEmoji: {
    fontSize: 20,
    textAlign: 'center',
  },
  editPaymentChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  editPaymentChipTextActive: {
    color: '#fff',
  },
  editPaymentChipTextDisabled: {
    color: '#94a3b8',
  },
  updateOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#f0f9ff',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  updateOrderBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  saveEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
  },
  saveEditBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  collectPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 10,
  },
  collectPaymentBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  updateOrderCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  updateOrderId: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  updateOrderCurrentList: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    maxHeight: 120,
  },
  updateOrderCurrentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  updateOrderCurrentText: {
    fontSize: 14,
    color: '#475569',
    flex: 1,
  },
  updateOrderCurrentTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  updateOrderHint: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  addNewDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    marginBottom: 12,
  },
  addNewDropdownTriggerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  addNewDropdownList: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
    overflow: 'hidden',
  },
  addNewDropdownScroll: {
    maxHeight: 220,
  },
  addNewDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addNewDropdownRowName: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
  addNewDropdownRowPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 10,
  },
  addNewDropdownDoneBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  addNewDropdownDoneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  updateOrderAddList: {
    marginBottom: 16,
    maxHeight: 140,
  },
  updateOrderAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  updateOrderAddName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  updateOrderAddQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 12,
  },
  updateOrderQtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  updateOrderQtyText: {
    fontSize: 14,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
    color: '#0f172a',
  },
  updateOrderAddTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  updateOrderMenuScroll: {
    maxHeight: 220,
    marginBottom: 16,
  },
  updateOrderMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  updateOrderMenuName: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  updateOrderMenuPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginRight: 10,
  },
  updateOrderMenuAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#0ea5e9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToOrderConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 14,
  },
  addToOrderConfirmBtnDisabled: {
    opacity: 0.5,
  },
  addToOrderConfirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  paymentCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
    height: '90%',
  },
  paymentCardScroll: {
    flex: 1,
    minHeight: 0,
  },
  paymentCardScrollContent: {
    paddingBottom: 24,
  },
  paymentOrderId: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  paymentDueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  paymentDueLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  paymentDueValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  paymentAmountWrap: {
    marginBottom: 12,
  },
  paymentAmountText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0ea5e9',
    marginBottom: 8,
  },
  payFullBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
  },
  payFullBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  keypadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  keypadKey: {
    width: '30%',
    minWidth: 0,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadKeyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  completePaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
  },
  completePaymentBtnDisabled: {
    opacity: 0.5,
  },
  completePaymentBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  loaderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loaderCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 48,
    alignItems: 'center',
    minWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  loaderIconWrap: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loaderRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: colors.primary,
    borderRightColor: colors.primaryLight,
  },
  loaderIconInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loaderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  loaderSubtitle: {
    fontSize: 15,
    color: '#64748b',
  },
  invoiceContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  invoiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  invoiceHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  invoiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  invoicePrintBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#059669',
    borderRadius: 12,
  },
  invoicePrintBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  invoiceDoneBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#0ea5e9',
    borderRadius: 12,
  },
  invoiceDoneBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  invoiceScroll: {
    flex: 1,
  },
  invoiceScrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  invoiceCompany: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  invoiceMeta: {
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 16,
  },
  invoiceDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  invoiceOrderLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  invoiceDate: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  invoiceType: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  invoiceItemName: {
    fontSize: 15,
    color: '#1e293b',
    flex: 1,
  },
  invoiceItemTotal: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  invoiceTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  invoiceTotalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0ea5e9',
  },
  invoicePayment: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  invoiceFooter: {
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceFooterText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  invoicePowered: {
    fontSize: 13,
    color: '#94a3b8',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.section,
    paddingHorizontal: spacing.xl,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: ACCENT,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    ...shadows.md,
  },
  ctaText: {
    color: colors.primaryContrast,
    ...typography.bodySemibold,
    fontSize: 16,
  },
  ctaSmall: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    ...Platform.select({
      ios: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
      android: { elevation: 6 },
    }),
  },
  ctaSmallText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
