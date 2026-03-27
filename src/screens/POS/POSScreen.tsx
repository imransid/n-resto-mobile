import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Vibration,
  Image,
  type ListRenderItemInfo,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import { useResponsive } from '../../hooks/useResponsive';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeInRight,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../hooks/useAuth';
import {
  getSubtotal,
  getTotal,
  generateOrderId,
  APP_SERVICE_CHARGE_VALUE,
  type OrderType,
  type PaymentMethod,
  type CartItem,
  type Modifier,
  type CompletedOrder,
} from '../../types/pos';
import { useMasterData } from '../../hooks/useMasterData';
import { storeConfig } from '../../constants/storeConfig';
import { getTables, type TableItem } from '../../services/tablesService';
import { getCustomersForPos, type CustomerItem } from '../../services/customersService';
import type { FoodItem } from '../../constants/demoData';
import { amountForChannel } from '../../utils/posPricing';
import { formatMenuMoney, formatPriceDelta } from '../../utils/formatMenuMoney';
import {
  defaultModifiersForVariantGroups,
  defaultVariantPriceDeltaSum,
  foodHasVariantGroups,
  initialVariantSelectionsFromGroups,
  variantDeltaRange,
} from '../../utils/posCatalogHelpers';
import { colors as themeColors, spacing, radius, typography, shadows } from '../../theme';
import { Badge, EmptyState, PressableScale } from '../../components/ui';
import { CATEGORY_EMOJI, ORDER_TYPE_EMOJI, FEATHER_ICONS } from '../../constants/appIcons';
import { PosFoodCard } from './PosFoodCard';
import {
  FOOD_LIST_INITIAL_NUM,
  FOOD_LIST_MAX_BATCH,
  FOOD_LIST_WINDOW_SIZE,
} from './posConstants';

const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'DINE_IN', label: 'Dine In' },
  { id: 'TAKEAWAY', label: 'Pick Up' },
  { id: 'DELIVERY', label: 'Delivery' },
];

const ACCENT = themeColors.posAccent;
/** Stacked POS chrome: uniform row height + vertical gap between rows */
const POS_HEADER_ROW_HEIGHT = 56;
const POS_HEADER_GAP = 4;
/** Delivery-style floating bar (charcoal) — warm accent on CTA */
const FLOATING_BAR_BG = '#1e293b';
const VARIANT_SEGMENT_MAX = 4;
const shadowMd = shadows.md;
const shadowSm = shadows.sm;
const shadowAccent = shadows.accent(ACCENT);

function coercePrice(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function POSScreen() {
  const isFocused = useIsFocused();
  const { auth } = useAuth();
  const {
    posSession,
    addToCart,
    updateCartItemQty,
    setCartItemModifiers,
    removeFromCartByIndex,
    clearCart,
    setOrderType,
    setTableNumber,
    setCustomerName,
    setOrderNotes,
    addCompletedOrder,
  } = useApp();
  const {
    cart,
    orderType,
    tableNumber,
    customerName,
    orderNotes,
    paymentMethod,
    discountPercent,
    chargePercent,
    taxPercent,
  } = posSession;
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const {
    numColumns,
    cartSheetHeightRatio,
    horizontalPadding,
    maxContentWidth,
    isTablet,
    isLargeTablet,
  } = useResponsive();
  const { categories, items, modifiers } = useMasterData();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(true);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [orderTypeSectionExpanded, setOrderTypeSectionExpanded] = useState(true);
  const [contextSectionExpanded, setContextSectionExpanded] = useState(true);
  /** When false, order type / context / search / category rows are not rendered (max menu space). */
  const [posChromeStackVisible, setPosChromeStackVisible] = useState(false);
  const searchInputRef = useRef<TextInput | null>(null);
  const wasSearchCollapsedRef = useRef(false);
  const [showPlaceOrder, setShowPlaceOrder] = useState(false);
  const [showOrderPlacedToast, setShowOrderPlacedToast] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  /** Local draft — avoids `persistPos` on every keystroke (fixes lag / focus loss on notes). */
  const [notesDraft, setNotesDraft] = useState('');
  const prevCartSheetOpen = useRef(false);
  const [modifiersCartIndex, setModifiersCartIndex] = useState<number | null>(null);
  const [variantPickFood, setVariantPickFood] = useState<FoodItem | null>(null);
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>({});
  const [variantSheetQty, setVariantSheetQty] = useState(1);
  const [variantHeroImageFailed, setVariantHeroImageFailed] = useState(false);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<TableItem | null>(null);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  /** After table/order context is set, require an explicit category pick (same flow as table gate). */
  const [categoryGateConfirmed, setCategoryGateConfirmed] = useState(false);
  /** Pickup/delivery: step 1 is table (or skip); step 2 is category — never show category gate first. */
  const [carryoutTableGatePassed, setCarryoutTableGatePassed] = useState(false);
  /** After "Pickup or delivery" from dine-in gate, go straight to category (skip carryout step 1). */
  const skipCarryoutTableGateAfterSwitchRef = useRef(false);
  const listRef = useRef<FlatList<FoodItem> | null>(null);
  const addToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [addToastLabel, setAddToastLabel] = useState<string | null>(null);

  useEffect(() => {
    if (orderType !== 'DINE_IN' && skipCarryoutTableGateAfterSwitchRef.current) {
      skipCarryoutTableGateAfterSwitchRef.current = false;
      setCarryoutTableGatePassed(true);
      setCategoryGateConfirmed(false);
      return;
    }
    setCarryoutTableGatePassed(false);
  }, [orderType]);

  useEffect(() => {
    if (orderType === 'DINE_IN') {
      setTablesLoading(true);
      getTables(storeConfig.tablesApiBase)
        .then(setTables)
        .finally(() => setTablesLoading(false));
      return;
    }
    if (!carryoutTableGatePassed && isFocused) {
      setTablesLoading(true);
      getTables(storeConfig.tablesApiBase)
        .then(setTables)
        .finally(() => setTablesLoading(false));
    } else {
      setSelectedTable(null);
      setTableDropdownOpen(false);
    }
  }, [orderType, carryoutTableGatePassed, isFocused]);

  useEffect(() => {
    if (!tableNumber) {
      setSelectedTable(null);
      return;
    }
    const matched = tables.find((t) => t.number === tableNumber) ?? null;
    setSelectedTable(matched);
  }, [tables, tableNumber]);

  useEffect(() => {
    setCustomersLoading(true);
    getCustomersForPos(storeConfig.customersApiBase)
      .then(setCustomers)
      .finally(() => setCustomersLoading(false));
  }, []);

  useEffect(() => {
    if (!customerName) {
      setSelectedCustomer(null);
      return;
    }
    const matched = customers.find((c) => c.name === customerName) ?? null;
    setSelectedCustomer(matched);
  }, [customers, customerName]);

  useEffect(() => {
    setCategoryGateConfirmed(false);
  }, [tableNumber, orderType]);

  const posCurrency = useMemo(
    () =>
      items.find((i) => i.pricesByChannel?.length)?.pricesByChannel?.[0]?.currency ??
      'BDT',
    [items],
  );

  const fmtMoney = useCallback(
    (n: number) => formatMenuMoney(n, posCurrency),
    [posCurrency],
  );

  /** Use current menu/modifier prices; base unit follows order type (dine-in vs pickup/delivery). */
  const cartPriced = useMemo(() => {
    return cart.map((c) => {
      const liveFood = items.find((i) => i.id === c.food.id);
      const merged = liveFood
        ? {
            ...c.food,
            ...liveFood,
            item_image_local: c.food.item_image_local ?? liveFood.item_image_local ?? null,
          }
        : { ...c.food };
      const unitBase = amountForChannel(merged, orderType);
      const food = { ...merged, price: unitBase };

      const mods = (c.modifiers ?? []).map((m) => {
        const live = modifiers.find((x) => x.id === m.id);
        return {
          ...m,
          price:
            live != null
              ? coercePrice(live.price, coercePrice(m.price, 0))
              : coercePrice(m.price, 0),
        };
      });
      return { ...c, food, modifiers: mods.length ? mods : undefined };
    });
  }, [cart, items, modifiers, orderType]);

  const lineTotal = useCallback((c: CartItem) => {
    const base = coercePrice(c.food.price, 0) * c.qty;
    const modTotal = (c.modifiers ?? []).reduce(
      (s, m) => s + coercePrice(m.price, 0) * c.qty,
      0
    );
    return base + modTotal;
  }, []);

  const sheetOpen = useSharedValue(0);
  const CART_SHEET_HEIGHT = Math.min(screenHeight * cartSheetHeightRatio, 640);

  useEffect(() => {
    if (showCartSheet) {
      sheetOpen.value = withSpring(1, {
        damping: 24,
        stiffness: 280,
        mass: 0.8,
      });
    } else {
      sheetOpen.value = withSpring(0, {
        damping: 26,
        stiffness: 320,
        mass: 0.7,
      });
    }
  }, [showCartSheet, sheetOpen]);

  useEffect(() => {
    if (showCartSheet && !prevCartSheetOpen.current) {
      setNotesDraft(orderNotes ?? '');
    }
    prevCartSheetOpen.current = showCartSheet;
  }, [showCartSheet, orderNotes]);

  const closeCartSheet = useCallback(() => {
    setOrderNotes(notesDraft).catch(() => {});
    sheetOpen.value = withSpring(
      0,
      {
        damping: 26,
        stiffness: 320,
        mass: 0.7,
      },
      (finished) => {
        if (finished) runOnJS(setShowCartSheet)(false);
      }
    );
  }, [notesDraft, setOrderNotes, sheetOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(sheetOpen.value, [0, 1], [0, 0.6]),
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(sheetOpen.value, [0, 1], [CART_SHEET_HEIGHT, 0]) },
    ],
  }));

  useEffect(() => {
    if (!showOrderPlacedToast) return;
    const t = setTimeout(() => setShowOrderPlacedToast(false), 2800);
    return () => clearTimeout(t);
  }, [showOrderPlacedToast]);

  useEffect(() => {
    if (modifiersCartIndex !== null && (modifiersCartIndex < 0 || modifiersCartIndex >= cart.length)) {
      setModifiersCartIndex(null);
    }
  }, [modifiersCartIndex, cart.length]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setTableDropdownOpen(false);
        setCustomerDropdownOpen(false);
      };
    }, [])
  );

  const categoryLabel = category === 'All' ? null : (categories.find((c) => c.id === category)?.label ?? '');
  const orderTypeLabel = ORDER_TYPES.find((t) => t.id === orderType)?.label ?? '';

  const filteredItems = useMemo(() => {
    let list =
      category === 'All'
        ? items
        : items.filter((f) => f.category === categoryLabel);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.item_name.toLowerCase().includes(q) ||
          (f.description || '').toLowerCase().includes(q)
      );
    }
    return list.filter((f) => f.status);
  }, [category, categoryLabel, items, search]);

  const menuListHeader = useMemo(
    () => (
      <View style={styles.menuSectionHeader}>
        <View style={styles.menuSectionTitleRow}>
          <Text style={styles.menuSectionTitle}>Menu</Text>
          <View style={styles.menuCountPill}>
            <Text style={styles.menuCountPillText}>
              {filteredItems.length}
            </Text>
          </View>
        </View>
        <Text style={styles.menuSectionMeta} numberOfLines={2}>
          {category === 'All' ? 'All categories' : (categoryLabel ?? 'Category')}
          {' · '}
          {orderTypeLabel}
          {search.trim().length > 0 ? ` · “${search.trim()}”` : ''}
        </Text>
      </View>
    ),
    [filteredItems.length, category, categoryLabel, orderTypeLabel, search],
  );

  const cartItemQtyTotal = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart]);
  const subtotal = getSubtotal(cartPriced);
  const total = getTotal(cartPriced, discountPercent, chargePercent, taxPercent);
  const selectedTableLabel = selectedTable ? `Table ${selectedTable.name ?? selectedTable.number}` : (tableNumber ? `Table ${tableNumber}` : '');
  const selectedCustomerLabel = selectedCustomer ? `${selectedCustomer.name}${selectedCustomer.phone ? ` · ${selectedCustomer.phone}` : ''}` : customerName;

  const contextCollapsedSummary = useMemo(() => {
    const tablePart =
      orderType !== 'DINE_IN'
        ? orderTypeLabel
        : tablesLoading
          ? 'Loading…'
          : selectedTableLabel || 'Choose table';
    const customerPart = customersLoading ? 'Loading…' : selectedCustomerLabel || 'Walk-in';
    return `${tablePart} · ${customerPart}`;
  }, [
    orderType,
    orderTypeLabel,
    tablesLoading,
    selectedTableLabel,
    customersLoading,
    selectedCustomerLabel,
  ]);

  /** Top bar: `Dine in -> Table 2 -> Name` (compact order context). */
  const posChromeContextTrail = useMemo(() => {
    const typePart =
      orderType === 'DINE_IN' ? 'Dine in' : orderType === 'TAKEAWAY' ? 'Pick up' : 'Delivery';
    const tablePart =
      orderType !== 'DINE_IN'
        ? '—'
        : tablesLoading
          ? '…'
          : selectedTableLabel || 'Choose table';
    const nameOnly = selectedCustomer?.name?.trim() || customerName?.trim() || '';
    const customerPart = customersLoading ? '…' : nameOnly || 'Walk-in';
    return `${typePart} -> ${tablePart} -> ${customerPart}`;
  }, [
    orderType,
    tablesLoading,
    selectedTableLabel,
    customersLoading,
    selectedCustomer,
    customerName,
  ]);
  /** Two-step gate for every order type: (1) table / table-or-skip, (2) category. */
  const dineInNeedsTable = orderType === 'DINE_IN' && !(tableNumber?.trim());
  const carryoutNeedsTableStep = orderType !== 'DINE_IN' && !carryoutTableGatePassed;
  const atTableGateStep = dineInNeedsTable || carryoutNeedsTableStep;
  const showPosGate = isFocused && (atTableGateStep || !categoryGateConfirmed);
  const gatePhase: 'table' | 'category' = atTableGateStep ? 'table' : 'category';

  const passCarryoutTableGate = useCallback(() => {
    setCarryoutTableGatePassed(true);
    setCategoryGateConfirmed(false);
  }, []);

  const pulseAddFeedback = useCallback((dishName: string) => {
    const label = dishName.length > 32 ? `${dishName.slice(0, 30)}…` : dishName;
    if (addToastTimerRef.current) clearTimeout(addToastTimerRef.current);
    setAddToastLabel(label);
    addToastTimerRef.current = setTimeout(() => {
      setAddToastLabel(null);
      addToastTimerRef.current = null;
    }, 1600);
    if (Platform.OS === 'android') {
      Vibration.vibrate(14);
    }
  }, []);

  useEffect(
    () => () => {
      if (addToastTimerRef.current) clearTimeout(addToastTimerRef.current);
    },
    [],
  );

  /** Scroll menu to top when filters change so the new list is always in view. */
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [category, search]);

  useEffect(() => {
    if (!searchExpanded) {
      wasSearchCollapsedRef.current = true;
      return;
    }
    if (!wasSearchCollapsedRef.current) return;
    wasSearchCollapsedRef.current = false;
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [searchExpanded]);

  const openCategoriesPanel = useCallback(() => {
    setCategoriesExpanded(true);
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
  }, []);

  const toggleAllPosChrome = useCallback(() => {
    setPosChromeStackVisible((visible) => {
      if (visible) {
        searchInputRef.current?.blur();
        setTableDropdownOpen(false);
        setCustomerDropdownOpen(false);
      }
      return !visible;
    });
  }, []);

  /** One tap: add immediately using catalog `defaultOptionId` (or first option). */
  const quickAddFood = useCallback(
    (food: FoodItem) => {
      const mods = defaultModifiersForVariantGroups(food.variantGroups);
      if (mods.length > 0) {
        addToCart({ food, qty: 1, modifiers: mods });
      } else {
        addToCart({ food, qty: 1 });
      }
      pulseAddFeedback(food.item_name);
    },
    [addToCart, pulseAddFeedback],
  );

  /** Long-press on item: pick beef/mutton etc. */
  const openVariantOptions = useCallback((food: FoodItem) => {
    if (!foodHasVariantGroups(food)) return;
    setVariantSelections(initialVariantSelectionsFromGroups(food.variantGroups));
    setVariantSheetQty(1);
    setVariantHeroImageFailed(false);
    setVariantPickFood(food);
  }, []);

  const confirmVariantPick = useCallback(() => {
    if (!variantPickFood) return;
    const mods: Modifier[] = [];
    for (const g of variantPickFood.variantGroups ?? []) {
      const optId = variantSelections[g.id];
      const opt = g.options.find((o) => o.id === optId);
      if (opt) mods.push({ id: opt.id, name: opt.name, price: opt.priceDelta });
    }
    const name = variantPickFood.item_name;
    addToCart({ food: variantPickFood, qty: variantSheetQty, modifiers: mods });
    setVariantPickFood(null);
    pulseAddFeedback(name);
  }, [variantPickFood, variantSelections, variantSheetQty, addToCart, pulseAddFeedback]);

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      Alert.alert('Empty cart', 'Add items before placing order.');
      return;
    }
    setShowPlaceOrder(true);
  };

  const handleConfirmAndPay = () => {
    const needsTable = orderType === 'DINE_IN';
    const hasTable = !!(tableNumber?.trim());
    if (needsTable && !hasTable) {
      Alert.alert('Required field', 'Please select a table number before saving the order.');
      return;
    }
    const enabled: PaymentMethod[] = storeConfig.enabledPaymentMethods ?? ['CASH'];
    const allowedMethod: PaymentMethod = enabled.length > 0 && enabled.includes(paymentMethod) ? paymentMethod : (enabled[0] ?? 'CASH');
    const modSum = (c: CartItem) =>
      (c.modifiers ?? []).reduce((s, m) => s + coercePrice(m.price, 0), 0);
    const orderLineItems = cartPriced.map((c) => ({
      id: c.food.id,
      name: c.food.item_name,
      price: coercePrice(c.food.price, 0) + modSum(c),
      qty: c.qty,
    }));
    const orderId = generateOrderId();
    const createdAt = new Date().toISOString();
    const order: CompletedOrder = {
      id: orderId,
      createdAt,
      items: orderLineItems,
      total,
      paymentMethod: allowedMethod,
      orderType,
      tableNumber: tableNumber || '',
      customerName: customerName || '',
      userId: auth.user?.id ?? '',
      companyId: (
        (auth.user?.companyId ?? '').trim() ||
        (storeConfig.masterDataCompanyId ?? '').trim()
      ),
      orderNotes: notesDraft.trim() || undefined,
      status: 'PENDING',
    };
    addCompletedOrder(order);
    setNotesDraft('');
    setShowPlaceOrder(false);
    setShowOrderPlacedToast(true);
  };

  const variantSheetUnitPrice = useMemo(() => {
    if (!variantPickFood) return 0;
    const base = amountForChannel(variantPickFood, orderType);
    let delta = 0;
    for (const g of variantPickFood.variantGroups ?? []) {
      const sel = variantSelections[g.id];
      const opt = g.options.find((o) => o.id === sel);
      if (opt) delta += opt.priceDelta;
    }
    return base + delta;
  }, [variantPickFood, variantSelections, orderType]);

  const variantSheetLineTotal = useMemo(
    () => variantSheetUnitPrice * variantSheetQty,
    [variantSheetUnitPrice, variantSheetQty],
  );

  const variantHeroUri = useMemo(() => {
    if (!variantPickFood || variantHeroImageFailed) return null;
    const p = variantPickFood.item_image_local?.trim();
    if (!p) return null;
    return p.startsWith('file') ? p : `file://${p}`;
  }, [variantPickFood, variantHeroImageFailed]);

  const variantHeroMonogram = useMemo(() => {
    const w = variantPickFood?.item_name?.trim().split(/\s+/)[0];
    return w ? w.charAt(0).toUpperCase() : '?';
  }, [variantPickFood?.item_name]);

  const renderFoodItem = useCallback(
    ({ item, index }: { item: FoodItem; index: number }) => {
      const cur = item.pricesByChannel?.[0]?.currency ?? posCurrency;
      const base = amountForChannel(item, orderType);
      const hasVar = foodHasVariantGroups(item);
      const defDelta = defaultVariantPriceDeltaSum(item.variantGroups);
      const priceLabel = formatMenuMoney(base + defDelta, cur);
      const span = variantDeltaRange(item.variantGroups);
      const rMin = base + span.min;
      const rMax = base + span.max;
      const rangeLabel =
        hasVar && rMax > rMin + 0.01
          ? `${formatMenuMoney(rMin, cur)} – ${formatMenuMoney(rMax, cur)}`
          : undefined;
      const defaultVariantSummary = hasVar
        ? defaultModifiersForVariantGroups(item.variantGroups)
            .map((m) => m.name)
            .join(' · ')
        : undefined;
      return (
        <View style={[styles.foodCardWrapper, { width: `${100 / numColumns}%` }]}>
          <PosFoodCard
            food={item}
            priceLabel={priceLabel}
            rangeLabel={rangeLabel}
            defaultVariantSummary={defaultVariantSummary}
            onQuickAdd={quickAddFood}
            onOpenOptions={hasVar ? openVariantOptions : undefined}
            index={index}
          />
        </View>
      );
    },
    [quickAddFood, openVariantOptions, numColumns, orderType, posCurrency],
  );

  const keyExtractor = useCallback((item: FoodItem) => item.id, []);

  const renderCartItem = (item: CartItem, index: number) => {
    const mods = item.modifiers ?? [];
    return (
      <View key={`${item.food.id}-${index}`} style={styles.cartRowWrap}>
        <View style={styles.cartRow}>
          <View style={styles.cartRowLeft}>
            <Text style={styles.cartName} numberOfLines={1}>
              {item.food.item_name}
            </Text>
            {mods.length > 0 && (
              <View style={styles.modifierChipsWrap}>
                {mods.map((m) => (
                  <View key={m.id} style={styles.modifierChip}>
                    <Text style={styles.modifierChipText}>{m.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.cartQtyRow}>
            <TouchableOpacity
              onPress={() => updateCartItemQty({ index, qty: item.qty - 1 })}
              hitSlop={12}
              style={styles.qtyBtn}
            >
              <Icon name="minus" size={18} color={ACCENT} />
            </TouchableOpacity>
            <Text style={styles.cartQty}>{item.qty}</Text>
            <TouchableOpacity
              onPress={() => addToCart({ food: item.food, qty: 1, modifiers: item.modifiers ?? [] })}
              hitSlop={12}
              style={styles.qtyBtn}
            >
              <Icon name="plus" size={18} color={ACCENT} />
            </TouchableOpacity>
          </View>
          <Text style={styles.cartLineTotal}>
            {fmtMoney(lineTotal(item))}
          </Text>
        </View>
        <View style={styles.cartRowActions}>
          <TouchableOpacity
            style={styles.modifiersBtn}
            onPress={() => setModifiersCartIndex(index)}
            activeOpacity={0.8}
          >
            <Icon name={FEATHER_ICONS.plus} size={14} color={ACCENT} />
            <Text style={styles.modifiersBtnText}>
              Modifiers{mods.length > 0 ? ` (${mods.length})` : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeItemBtn}
            onPress={() => removeFromCartByIndex(index)}
            hitSlop={8}
            activeOpacity={0.8}
          >
            <Icon name="trash-2" size={16} color="#dc2626" />
            <Text style={styles.removeItemBtnText}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderTableGateItem = useCallback(
    ({ item, index }: ListRenderItemInfo<TableItem>) => (
      <View style={styles.tableGateCell}>
        <Animated.View
          entering={FadeInDown.delay(Math.min(index * 42, 320)).duration(340).springify().damping(17)}
          style={styles.tableGateTileWrap}
        >
          <PressableScale
            style={styles.tableGateTile}
            activeScale={0.96}
            onPress={() => {
              if (orderType !== 'DINE_IN') {
                setOrderType('DINE_IN').catch(() => {});
              }
              setTableNumber(item.number);
              setSelectedTable(item);
            }}
          >
            <View style={styles.tableGateTileIconRow}>
              <View style={styles.tableGateTileIconBg}>
                <Icon name="grid" size={18} color={ACCENT} />
              </View>
            </View>
            <Text style={styles.tableGateTileNumber} numberOfLines={1}>
              {item.name ?? item.number}
            </Text>
            <Text style={styles.tableGateTileCaption}>Table number</Text>
          </PressableScale>
        </Animated.View>
      </View>
    ),
    [orderType, setOrderType, setTableNumber]
  );

  const tableGateKeyExtractor = useCallback((item: TableItem) => item.id, []);

  type CategoryRow = { id: string; label: string };

  const renderCategoryGateItem = useCallback(
    ({ item, index }: ListRenderItemInfo<CategoryRow>) => {
      const emoji = CATEGORY_EMOJI[item.id] ?? '🍽️';
      return (
        <View style={styles.tableGateCell}>
          <Animated.View
            entering={FadeInDown.delay(Math.min(index * 42, 320)).duration(340).springify().damping(17)}
            style={styles.tableGateTileWrap}
          >
            <PressableScale
              style={styles.tableGateTile}
              activeScale={0.96}
              onPress={() => {
                setCategory(item.id);
                setCategoryGateConfirmed(true);
              }}
            >
              <View style={styles.tableGateTileIconRow}>
                <View style={styles.tableGateTileIconBg}>
                  <Text style={styles.categoryGateEmoji} allowFontScaling={false}>
                    {emoji}
                  </Text>
                </View>
              </View>
              <Text style={styles.tableGateTileNumber} numberOfLines={2}>
                {item.label}
              </Text>
              <Text style={styles.tableGateTileCaption}>
                {item.id === 'All' ? 'Full menu' : 'Food category'}
              </Text>
            </PressableScale>
          </Animated.View>
        </View>
      );
    },
    []
  );

  const categoryGateKeyExtractor = useCallback((item: CategoryRow) => item.id, []);

  const categoryGridColumns = isLargeTablet ? 6 : isTablet ? 5 : 4;

  return (
    <View style={[styles.container, isTablet && { alignItems: 'center', maxWidth: maxContentWidth, width: '100%' }]}>
      <Modal
        visible={showPosGate}
        animationType="fade"
        transparent
        statusBarTranslucent
        presentationStyle="overFullScreen"
      >
        <View style={[styles.tableGateRoot, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 12 }]}>
          <Animated.View
            key={gatePhase}
            entering={FadeInDown.duration(400).springify().damping(17)}
            style={styles.tableGateCard}
          >
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={styles.tableGateGlowTop} />
              <View style={styles.tableGateGlowBlob} />
            </View>

            <View style={styles.gateStepsRow}>
              <View style={styles.gateStepsTrack}>
                <View style={[styles.gateStepDot, gatePhase === 'table' && styles.gateStepDotActive]} />
                <View
                  style={[
                    styles.gateStepLine,
                    gatePhase === 'category' && styles.gateStepLineActive,
                  ]}
                />
                <View style={[styles.gateStepDot, gatePhase === 'category' && styles.gateStepDotActive]} />
              </View>
              <Text style={styles.gateStepsLabel}>
                {gatePhase === 'table'
                  ? 'Step 1 of 2 · Table number'
                  : 'Step 2 of 2 · Food category'}
              </Text>
            </View>

            {gatePhase === 'table' ? (
              orderType === 'DINE_IN' ? (
              <>
                <View style={styles.tableGateHero}>
                  <View style={styles.tableGatePill}>
                    <View style={styles.tableGatePillDot} />
                    <Text style={styles.tableGatePillText}>Dine-in</Text>
                  </View>
                  <View style={styles.tableGateHeroIconWrap}>
                    <View style={styles.tableGateHeroRingOuter}>
                      <View style={styles.tableGateHeroRing}>
                        <Icon name="coffee" size={28} color="#fff" />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.tableGateTitle}>Choose table number</Text>
                  <Text style={styles.tableGateSubtitle}>
                    Next you’ll choose a food category, then add items. You can change table number or category
                    anytime from the bar above.
                  </Text>
                </View>

                {tablesLoading ? (
                  <View style={styles.tableGateLoading}>
                    <ActivityIndicator size="large" color={ACCENT} />
                    <Text style={styles.tableGateLoadingText}>Loading floor plan…</Text>
                  </View>
                ) : tables.length === 0 ? (
                  <View style={styles.tableGateEmpty}>
                    <Icon name="wifi-off" size={36} color="rgba(148, 163, 184, 0.7)" style={styles.tableGateEmptyIcon} />
                    <Text style={styles.tableGateEmptyText}>
                      No tables available. Check your connection or use pickup below.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={tables}
                    keyExtractor={tableGateKeyExtractor}
                    renderItem={renderTableGateItem}
                    numColumns={2}
                    scrollEnabled={tables.length > 6}
                    style={styles.tableGateList}
                    contentContainerStyle={styles.tableGateListContent}
                    columnWrapperStyle={styles.tableGateRow}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  />
                )}

                <View style={styles.tableGateDivider} />

                <TouchableOpacity
                  style={styles.tableGateAlt}
                  onPress={() => {
                    skipCarryoutTableGateAfterSwitchRef.current = true;
                    setOrderType('TAKEAWAY').catch(() => {});
                  }}
                  activeOpacity={0.82}
                >
                  <View style={styles.tableGateAltInner}>
                    <View style={styles.tableGateAltIconWrap}>
                      <Icon name="package" size={20} color={ACCENT} />
                    </View>
                    <View style={styles.tableGateAltTextCol}>
                      <Text style={styles.tableGateAltTitle}>Pickup or delivery</Text>
                      <Text style={styles.tableGateAltSub}>No table — go to food categories (step 2)</Text>
                    </View>
                    <Icon name="chevron-right" size={22} color="rgba(148, 163, 184, 0.9)" />
                  </View>
                </TouchableOpacity>
              </>
              ) : (
              <>
                <View style={styles.tableGateHero}>
                  <View style={styles.tableGatePill}>
                    <View style={styles.tableGatePillDot} />
                    <Text style={styles.tableGatePillText}>
                      {orderType === 'DELIVERY' ? 'Delivery' : 'Pick up'}
                    </Text>
                  </View>
                  <View style={styles.tableGateHeroIconWrap}>
                    <View style={styles.tableGateHeroRingOuter}>
                      <View style={styles.tableGateHeroRing}>
                        <Icon name="grid" size={28} color="#fff" />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.tableGateTitle}>Choose table number</Text>
                  <Text style={styles.tableGateSubtitle}>
                    Tap a table if this order is for the dining room (switches to Dine in), or continue without a table
                    to pick your category next.
                  </Text>
                </View>

                {tablesLoading ? (
                  <View style={styles.tableGateLoading}>
                    <ActivityIndicator size="large" color={ACCENT} />
                    <Text style={styles.tableGateLoadingText}>Loading tables…</Text>
                  </View>
                ) : tables.length === 0 ? (
                  <View style={styles.tableGateEmpty}>
                    <Icon name="wifi-off" size={36} color="rgba(148, 163, 184, 0.7)" style={styles.tableGateEmptyIcon} />
                    <Text style={styles.tableGateEmptyText}>
                      No tables listed. Continue to categories or switch to Dine in later from the bar.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={tables}
                    keyExtractor={tableGateKeyExtractor}
                    renderItem={renderTableGateItem}
                    numColumns={2}
                    scrollEnabled={tables.length > 6}
                    style={styles.tableGateList}
                    contentContainerStyle={styles.tableGateListContent}
                    columnWrapperStyle={styles.tableGateRow}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  />
                )}

                <View style={styles.tableGateDivider} />

                <TouchableOpacity
                  style={styles.tableGateAlt}
                  onPress={passCarryoutTableGate}
                  activeOpacity={0.82}
                >
                  <View style={styles.tableGateAltInner}>
                    <View style={styles.tableGateAltIconWrap}>
                      <Icon name="layers" size={20} color={ACCENT} />
                    </View>
                    <View style={styles.tableGateAltTextCol}>
                      <Text style={styles.tableGateAltTitle}>Continue without table</Text>
                      <Text style={styles.tableGateAltSub}>Step 2 · Choose food category</Text>
                    </View>
                    <Icon name="chevron-right" size={22} color="rgba(148, 163, 184, 0.9)" />
                  </View>
                </TouchableOpacity>
              </>
              )
            ) : (
              <>
                <View style={styles.tableGateHero}>
                  <View style={styles.tableGatePill}>
                    <View style={styles.tableGatePillDot} />
                    <Text style={styles.tableGatePillText}>Menu</Text>
                  </View>
                  <View style={styles.tableGateHeroIconWrap}>
                    <View style={styles.tableGateHeroRingOuter}>
                      <View style={styles.tableGateHeroRing}>
                        <Icon name="layers" size={28} color="#fff" />
                      </View>
                    </View>
                  </View>
                  <Text style={styles.tableGateTitle}>Choose food category</Text>
                  <Text style={styles.tableGateSubtitle}>
                    {orderType === 'DINE_IN' && selectedTableLabel
                      ? `${selectedTableLabel} · pick a section, then add items to the cart.`
                      : 'Pick a section, then add items to the cart.'}
                  </Text>
                </View>

                <FlatList
                  data={categories}
                  keyExtractor={categoryGateKeyExtractor}
                  renderItem={renderCategoryGateItem}
                  numColumns={2}
                  scrollEnabled={categories.length > 6}
                  style={styles.tableGateList}
                  contentContainerStyle={styles.tableGateListContent}
                  columnWrapperStyle={styles.tableGateRow}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                />

                {orderType === 'DINE_IN' ? (
                  <TouchableOpacity
                    style={styles.gateChangeTableBtn}
                    onPress={() => setTableNumber('')}
                    activeOpacity={0.75}
                  >
                    <Icon name="arrow-left" size={18} color={ACCENT} />
                    <Text style={styles.gateChangeTableText}>Change table number</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </Animated.View>
        </View>
      </Modal>

      {showOrderPlacedToast && (
        <Animated.View
          entering={FadeInUp.duration(400).springify().damping(16)}
          style={[styles.toastWrap, { top: insets.top + 12 }]}
          pointerEvents="none"
        >
          <View style={styles.toast}>
            <View style={styles.toastIconRing}>
              <Icon name="check" size={28} color={themeColors.primaryContrast} />
            </View>
            <View style={styles.toastTextWrap}>
              <Text style={styles.toastTitle}>Order placed</Text>
              <Text style={styles.toastSubtitle}>Saved to order list. Cart cleared — ready for new order.</Text>
            </View>
          </View>
        </Animated.View>
      )}
      <View style={[styles.posChromeBulkBar, { marginHorizontal: horizontalPadding, marginTop: spacing.sm }]}>
        <TouchableOpacity
          onPress={toggleAllPosChrome}
          hitSlop={12}
          style={styles.posChromeBulkToggle}
          accessibilityLabel={posChromeStackVisible ? 'Hide all POS panels' : 'Show all POS panels'}
          accessibilityRole="button"
        >
          <Text style={styles.categoryHeaderActionText}>
            {posChromeStackVisible ? 'Hide all' : 'Show all'}
          </Text>
          <Icon name={posChromeStackVisible ? 'chevron-up' : 'chevron-down'} size={16} color={ACCENT} />
        </TouchableOpacity>
        <Text
          style={styles.posChromeBulkTrail}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {posChromeContextTrail}
        </Text>
      </View>
      {posChromeStackVisible ? (
      <>
      <View style={[styles.posChromeSection, { marginHorizontal: horizontalPadding }]}>
        {orderTypeSectionExpanded ? (
          <>
            <View style={styles.posChromeHeader}>
              <Text style={styles.posChromeHeaderTitle}>Order type</Text>
              <TouchableOpacity
                onPress={() => setOrderTypeSectionExpanded(false)}
                hitSlop={12}
                style={styles.categoryHeaderAction}
                accessibilityLabel="Collapse order type"
                accessibilityRole="button"
              >
                <Text style={styles.categoryHeaderActionText}>Hide</Text>
                <Icon name="chevron-up" size={16} color={ACCENT} />
              </TouchableOpacity>
            </View>
            <View style={[styles.orderTypeRow, styles.posChromeInner]}>
              {ORDER_TYPES.map((ot) => (
                <PressableScale
                  key={ot.id}
                  activeScale={0.97}
                  style={[styles.orderTypeBtn, orderType === ot.id && styles.orderTypeBtnActive]}
                  onPress={() => setOrderType(ot.id)}
                >
                  <Text style={styles.orderTypeEmoji} allowFontScaling={false}>
                    {ORDER_TYPE_EMOJI[ot.id]}
                  </Text>
                  <Text
                    style={[
                      styles.orderTypeLabel,
                      orderType === ot.id && styles.orderTypeLabelActive,
                    ]}
                  >
                    {ot.label}
                  </Text>
                </PressableScale>
              ))}
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.posChromeCollapsed}
            onPress={() => setOrderTypeSectionExpanded(true)}
            activeOpacity={0.75}
            accessibilityLabel="Expand order type"
            accessibilityRole="button"
          >
            <View style={styles.categoryCollapsedIconWrap}>
              <Text style={styles.categoryCollapsedEmoji} allowFontScaling={false}>
                {ORDER_TYPE_EMOJI[orderType]}
              </Text>
            </View>
            <View style={styles.categoryCollapsedTextCol}>
              <Text style={styles.categoryCollapsedKicker}>Order type</Text>
              <Text style={styles.categoryCollapsedValue} numberOfLines={1}>
                {orderTypeLabel}
              </Text>
            </View>
            <Icon name="chevron-down" size={16} color={themeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.posChromeSection, { marginHorizontal: horizontalPadding }]}>
        {contextSectionExpanded ? (
          <>
            <View style={styles.posChromeHeader}>
              <Text style={styles.posChromeHeaderTitle}>Table & customer</Text>
              <TouchableOpacity
                onPress={() => setContextSectionExpanded(false)}
                hitSlop={12}
                style={styles.categoryHeaderAction}
                accessibilityLabel="Collapse table and customer"
                accessibilityRole="button"
              >
                <Text style={styles.categoryHeaderActionText}>Hide</Text>
                <Icon name="chevron-up" size={16} color={ACCENT} />
              </TouchableOpacity>
            </View>
            <Animated.View entering={FadeIn.duration(200)} style={[styles.contextCard, styles.posChromeInner]}>
              <View style={styles.contextRowCombined}>
                <View
                  style={[
                    styles.contextCell,
                    orderType !== 'DINE_IN' && styles.contextCellMuted,
                  ]}
                >
                  <View style={styles.contextIconBubble}>
                    <Icon name="grid" size={18} color={orderType === 'DINE_IN' ? ACCENT : themeColors.textSubtle} />
                  </View>
                  <TouchableOpacity
                    style={styles.tableDropdown}
                    onPress={() => {
                      if (orderType !== 'DINE_IN') {
                        setOrderType('DINE_IN').catch(() => {});
                        return;
                      }
                      setTableDropdownOpen(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contextLabelCol}>
                      <Text style={styles.contextFieldLabel}>Table</Text>
                      <Text
                        style={
                          orderType === 'DINE_IN' && tableNumber
                            ? styles.tableDropdownText
                            : styles.tableDropdownPlaceholder
                        }
                        numberOfLines={1}
                      >
                        {orderType !== 'DINE_IN'
                          ? 'Tap · Dine in'
                          : tablesLoading
                            ? 'Loading…'
                            : selectedTableLabel || 'Choose'}
                      </Text>
                    </View>
                    <Icon name="chevron-down" size={16} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.contextVerticalRule} />
                <View style={styles.contextCell}>
                  <View style={styles.contextIconBubble}>
                    <Icon name="user" size={18} color={ACCENT} />
                  </View>
                  <TouchableOpacity
                    style={styles.tableDropdown}
                    onPress={() => setCustomerDropdownOpen(true)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contextLabelCol}>
                      <Text style={styles.contextFieldLabel}>Customer</Text>
                      <Text
                        style={customerName ? styles.tableDropdownText : styles.tableDropdownPlaceholder}
                        numberOfLines={1}
                      >
                        {customersLoading ? 'Loading…' : selectedCustomerLabel || 'Walk-in'}
                      </Text>
                    </View>
                    <Icon name="chevron-down" size={16} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.posChromeCollapsed}
            onPress={() => setContextSectionExpanded(true)}
            activeOpacity={0.75}
            accessibilityLabel="Expand table and customer"
            accessibilityRole="button"
          >
            <View style={styles.categoryCollapsedIconWrap}>
              <Icon name="users" size={20} color={ACCENT} />
            </View>
            <View style={styles.categoryCollapsedTextCol}>
              <Text style={styles.categoryCollapsedKicker}>Table & customer</Text>
              <Text style={styles.categoryCollapsedValue} numberOfLines={1}>
                {contextCollapsedSummary}
              </Text>
            </View>
            <Icon name="chevron-down" size={16} color={themeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.posChromeSection, { marginHorizontal: horizontalPadding }]}>
        {searchExpanded ? (
          <>
            <View style={styles.posChromeHeader}>
              <Text style={styles.posChromeHeaderTitle}>Search</Text>
              <TouchableOpacity
                onPress={() => {
                  searchInputRef.current?.blur();
                  setSearchExpanded(false);
                }}
                hitSlop={12}
                style={styles.categoryHeaderAction}
                accessibilityLabel="Collapse search"
                accessibilityRole="button"
              >
                <Text style={styles.categoryHeaderActionText}>Hide</Text>
                <Icon name="chevron-up" size={16} color={ACCENT} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchRowOuter, styles.posChromeInner]}>
              <View
                style={[
                  styles.searchWrap,
                  searchFocused && styles.searchWrapFocused,
                ]}
              >
                <Icon name={FEATHER_ICONS.search} size={18} color={themeColors.textSubtle} style={styles.searchIcon} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.search}
                  placeholder="Search menu..."
                  placeholderTextColor={themeColors.textSubtle}
                  value={search}
                  onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  returnKeyType="search"
                  clearButtonMode="never"
                />
                {search.trim().length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setSearch('')}
                    hitSlop={12}
                    style={styles.searchClear}
                    accessibilityLabel="Clear search"
                  >
                    <Icon name="x-circle" size={22} color={themeColors.textSubtle} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity
                style={[styles.searchFilterBtn, !categoriesExpanded && styles.searchFilterBtnActive]}
                onPress={openCategoriesPanel}
                accessibilityLabel={
                  categoriesExpanded ? 'Scroll to top and highlight categories' : 'Show category grid'
                }
                accessibilityRole="button"
              >
                <Icon
                  name="sliders"
                  size={20}
                  color={!categoriesExpanded ? ACCENT : themeColors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={[styles.searchRowOuter, styles.posChromeInner]}>
            <View style={styles.searchCollapsedBar}>
              <TouchableOpacity
                style={styles.searchCollapsedMain}
                onPress={() => setSearchExpanded(true)}
                activeOpacity={0.75}
                accessibilityLabel="Expand search"
                accessibilityRole="button"
              >
                <Icon name={FEATHER_ICONS.search} size={18} color={themeColors.textSubtle} />
                <Text style={styles.searchCollapsedText} numberOfLines={1}>
                  {search.trim().length > 0 ? `“${search.trim()}”` : 'Search menu...'}
                </Text>
              </TouchableOpacity>
              {search.trim().length > 0 ? (
                <TouchableOpacity
                  onPress={() => setSearch('')}
                  hitSlop={10}
                  style={styles.searchCollapsedClear}
                  accessibilityLabel="Clear search"
                >
                  <Icon name="x-circle" size={20} color={themeColors.textSubtle} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={() => setSearchExpanded(true)}
                hitSlop={10}
                style={styles.searchCollapsedChevron}
                accessibilityLabel="Expand search"
                accessibilityRole="button"
              >
                <Icon name="chevron-down" size={16} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.searchFilterBtn, !categoriesExpanded && styles.searchFilterBtnActive]}
              onPress={openCategoriesPanel}
              accessibilityLabel={
                categoriesExpanded ? 'Scroll to top and highlight categories' : 'Show category grid'
              }
              accessibilityRole="button"
            >
              <Icon
                name="sliders"
                size={20}
                color={!categoriesExpanded ? ACCENT : themeColors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={[styles.posChromeSection, { marginHorizontal: horizontalPadding }]}>
        {categoriesExpanded ? (
          <>
            <View style={styles.posChromeHeader}>
              <Text style={styles.posChromeHeaderTitle}>Categories</Text>
              <TouchableOpacity
                onPress={() => setCategoriesExpanded(false)}
                hitSlop={12}
                style={styles.categoryHeaderAction}
                accessibilityLabel="Collapse categories"
                accessibilityRole="button"
              >
                <Text style={styles.categoryHeaderActionText}>Hide</Text>
                <Icon name="chevron-up" size={16} color={ACCENT} />
              </TouchableOpacity>
            </View>
            <View style={styles.categoryGrid}>
              {categories.map((c, idx) => {
                const emoji = CATEGORY_EMOJI[c.id] ?? '🍽️';
                const isActive = category === c.id;
                return (
                  <Animated.View
                    key={c.id}
                    entering={FadeInRight.delay(Math.min(idx, 12) * 28).duration(240).springify().damping(18)}
                    style={[styles.categoryGridCell, { width: `${100 / categoryGridColumns}%` }]}
                  >
                    <PressableScale
                      activeScale={0.96}
                      style={[styles.categoryGridTile, isActive && styles.categoryGridTileActive]}
                      onPress={() => setCategory(c.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.label} category`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={styles.categoryGridEmoji} allowFontScaling={false}>
                        {emoji}
                      </Text>
                      <Text
                        style={[styles.categoryGridLabel, isActive && styles.categoryGridLabelActive]}
                        numberOfLines={2}
                      >
                        {c.label}
                      </Text>
                    </PressableScale>
                  </Animated.View>
                );
              })}
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={styles.categoryCollapsedBar}
            onPress={() => setCategoriesExpanded(true)}
            activeOpacity={0.75}
            accessibilityLabel="Expand categories"
            accessibilityRole="button"
          >
            <View style={styles.categoryCollapsedIconWrap}>
              <Text style={styles.categoryCollapsedEmoji} allowFontScaling={false}>
                {CATEGORY_EMOJI[category] ?? '🍽️'}
              </Text>
            </View>
            <View style={styles.categoryCollapsedTextCol}>
              <Text style={styles.categoryCollapsedKicker}>Category</Text>
              <Text style={styles.categoryCollapsedValue} numberOfLines={1}>
                {category === 'All' ? 'All' : (categoryLabel ?? category)}
              </Text>
            </View>
            <Icon name="chevron-down" size={16} color={themeColors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      </>
      ) : null}

      <Modal
        visible={tableDropdownOpen && orderType === 'DINE_IN'}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setTableDropdownOpen(false)}
      >
        <View style={styles.tableModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTableDropdownOpen(false)} />
          <View style={styles.tableModalContent} pointerEvents="box-none">
            <View style={styles.tableModalHeader}>
              <Text style={styles.tableModalTitle}>Select table</Text>
              <TouchableOpacity onPress={() => setTableDropdownOpen(false)} hitSlop={12}>
                <Icon name="x" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.tableModalScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[styles.tableOption, !tableNumber && styles.tableOptionActive]}
                onPress={() => {
                  setTableNumber('');
                  setSelectedTable(null);
                  setOrderType('TAKEAWAY').catch(() => {});
                  setTableDropdownOpen(false);
                }}
              >
                <Text style={[styles.tableOptionText, !tableNumber && styles.tableOptionTextActive]}>No table</Text>
              </TouchableOpacity>
              {tables.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.tableOption, tableNumber === t.number && styles.tableOptionActive]}
                  onPress={() => {
                    setTableNumber(t.number);
                    setSelectedTable(t);
                    setTableDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.tableOptionText, tableNumber === t.number && styles.tableOptionTextActive]}>
                    Table {t.name ?? t.number}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={customerDropdownOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setCustomerDropdownOpen(false)}
      >
        <View style={styles.tableModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCustomerDropdownOpen(false)} />
          <View style={styles.tableModalContent} pointerEvents="box-none">
            <View style={styles.tableModalHeader}>
              <Text style={styles.tableModalTitle}>Select customer</Text>
              <TouchableOpacity onPress={() => setCustomerDropdownOpen(false)} hitSlop={12}>
                <Icon name="x" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.tableModalScroll} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[styles.tableOption, !customerName && styles.tableOptionActive]}
                onPress={() => {
                  setCustomerName('');
                  setSelectedCustomer(null);
                  setCustomerDropdownOpen(false);
                }}
              >
                <Text style={[styles.tableOptionText, !customerName && styles.tableOptionTextActive]}>No customer</Text>
              </TouchableOpacity>
              {customers.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.tableOption, customerName === c.name && styles.tableOptionActive]}
                  onPress={() => {
                    setCustomerName(c.name);
                    setSelectedCustomer(c);
                    setCustomerDropdownOpen(false);
                  }}
                >
                  <Text style={[styles.tableOptionText, customerName === c.name && styles.tableOptionTextActive]}>
                    {c.name}{c.phone ? ` · ${c.phone}` : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {filteredItems.length === 0 ? (
        <Animated.View
          entering={FadeIn.duration(300)}
          style={[styles.foodList, { paddingHorizontal: horizontalPadding }]}
        >
          {menuListHeader}
          <EmptyState
            icon={<Text style={styles.emptyEmoji} allowFontScaling={false}>🔍</Text>}
            title="Nothing here yet"
            subtitle="Clear the search, pick another category, or choose “All” to see everything."
          />
        </Animated.View>
      ) : (
        <FlatList
          ref={listRef}
          data={filteredItems}
          renderItem={renderFoodItem}
          keyExtractor={keyExtractor}
          key={numColumns}
          numColumns={numColumns}
          ListHeaderComponent={menuListHeader}
          initialNumToRender={FOOD_LIST_INITIAL_NUM}
          maxToRenderPerBatch={FOOD_LIST_MAX_BATCH}
          windowSize={FOOD_LIST_WINDOW_SIZE}
          updateCellsBatchingPeriod={50}
          contentContainerStyle={[styles.mainContent, { paddingHorizontal: horizontalPadding }]}
          columnWrapperStyle={numColumns > 1 ? styles.foodGridRow : undefined}
          style={styles.main}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      <PressableScale
        activeScale={0.98}
        style={[
          styles.floatingCartBar,
          cart.length === 0 && styles.floatingCartBarEmpty,
          {
            bottom: insets.bottom + 14,
            ...(cart.length > 0
              ? { left: horizontalPadding, right: horizontalPadding }
              : { alignSelf: 'center' as const }),
          },
        ]}
        onPress={() => setShowCartSheet(true)}
      >
        {cart.length > 0 ? (
          <View style={styles.floatingCartBarInner}>
            <View style={styles.floatingCartBarTextCol}>
              <Text style={styles.floatingCartBarKicker} numberOfLines={1}>
                {cartItemQtyTotal === 1 ? '1 item in order' : `${cartItemQtyTotal} items in order`}
              </Text>
              <Text style={styles.floatingCartBarTotal} numberOfLines={1}>
                {fmtMoney(subtotal)}
              </Text>
            </View>
            <View style={styles.floatingCartBarCtaCircle}>
              <Icon name="shopping-bag" size={22} color={themeColors.primaryContrast} />
            </View>
          </View>
        ) : (
          <View style={styles.floatingCartBarEmptyInner}>
            <Icon name="shopping-bag" size={24} color={themeColors.primaryContrast} />
          </View>
        )}
      </PressableScale>

      {addToastLabel ? (
        <Animated.View
          entering={FadeInUp.duration(260).springify().damping(18)}
          pointerEvents="none"
          style={[styles.addToastWrap, { bottom: insets.bottom + 96 }]}
        >
          <View style={styles.addToast}>
            <View style={styles.addToastIcon}>
              <Icon name="check" size={18} color={themeColors.primaryContrast} />
            </View>
            <View style={styles.addToastTextCol}>
              <Text style={styles.addToastKicker}>Added to order</Text>
              <Text style={styles.addToastTitle} numberOfLines={2}>
                {addToastLabel}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {/* Cart bottom sheet — opens from bottom with Reanimated */}
      <Modal
        visible={showCartSheet}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeCartSheet}
      >
        <View style={styles.cartSheetContainer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCartSheet}>
            <Animated.View style={[styles.cartSheetBackdrop, backdropStyle]} />
          </Pressable>
          <Animated.View
            style={[
              styles.cartSheet,
              { height: CART_SHEET_HEIGHT, paddingBottom: insets.bottom + 16 },
              sheetStyle,
            ]}
          >
            <View style={styles.cartSheetHandle} />
            <View style={styles.cartSheetHeader}>
              <View style={styles.cartSheetTitleBlock}>
                <View style={styles.cartSheetTitleRow}>
                  <Text style={styles.cartTitle}>Current order</Text>
                  {cart.length > 0 && (
                    <Badge count={cart.reduce((s, c) => s + c.qty, 0)} style={styles.cartBadgeMargin} />
                  )}
                </View>
                {cart.length > 0 ? (
                  <Text style={styles.cartSheetSubtitle}>
                    {cartItemQtyTotal === 1 ? '1 item' : `${cartItemQtyTotal} items`} · {fmtMoney(subtotal)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                onPress={closeCartSheet}
                hitSlop={12}
                style={styles.cartSheetCloseBtn}
              >
                <Icon name="x" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            {cart.length === 0 ? (
              <EmptyState
                icon={<Text style={styles.cartEmptyEmoji} allowFontScaling={false}>🛒</Text>}
                title="Nothing in the cart yet"
                subtitle="Tap dishes on the menu — they’ll show up here"
              />
            ) : (
              <ScrollView
                style={styles.cartSheetScroll}
                contentContainerStyle={styles.cartSheetScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                {cartPriced.map((item, index) => renderCartItem(item, index))}
                <View style={styles.notesWrap}>
                  <Icon name="message-circle" size={18} color={themeColors.textSubtle} />
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Order notes (optional)"
                    placeholderTextColor={themeColors.textSubtle}
                    value={notesDraft}
                    onChangeText={setNotesDraft}
                    multiline
                  />
                </View>
                <View style={styles.totals}>
                  <Row label="Subtotal" value={subtotal} format={fmtMoney} />
                  <Row label="Service charge" value={APP_SERVICE_CHARGE_VALUE} format={fmtMoney} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>{fmtMoney(total)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.addMoreFromCartBtn}
                  onPress={closeCartSheet}
                  activeOpacity={0.85}
                >
                  <Icon name="plus-circle" size={20} color={ACCENT} />
                  <Text style={styles.addMoreFromCartBtnText}>Add more items</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, shadowAccent]}
                  onPress={() => {
                    handlePlaceOrder();
                    closeCartSheet();
                  }}
                  activeOpacity={0.85}
                >
                  <Icon name="shopping-bag" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Review & place order</Text>
                  <Icon name="arrow-right" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => {
                    clearCart();
                    closeCartSheet();
                  }}
                >
                  <Icon name="trash-2" size={16} color={themeColors.textSubtle} />
                  <Text style={styles.clearBtnText}>Clear cart</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* Confirm Order modal: review order summary, then confirm */}
      <Modal
        visible={showPlaceOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlaceOrder(false)}
      >
        <View style={styles.placeOrderOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPlaceOrder(false)} />
          <Animated.View
            entering={FadeInDown.duration(320).springify().damping(20)}
            style={styles.placeOrderCard}
          >
            <View style={styles.placeOrderHeader}>
              <Text style={styles.placeOrderTitle}>Confirm Order</Text>
              <TouchableOpacity onPress={() => setShowPlaceOrder(false)} hitSlop={12}>
                <Icon name="x" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.placeOrderScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.placeOrderSectionLabel}>Order summary</Text>
              {orderType === 'DINE_IN' && !!selectedTableLabel && (
                <View style={styles.placeOrderItemRow}>
                  <Text style={styles.placeOrderItemName}>Table number</Text>
                  <Text style={styles.placeOrderItemTotal}>{selectedTableLabel}</Text>
                </View>
              )}
              {!!selectedCustomerLabel && (
                <View style={styles.placeOrderItemRow}>
                  <Text style={styles.placeOrderItemName}>Selected customer</Text>
                  <Text style={styles.placeOrderItemTotal}>{selectedCustomerLabel}</Text>
                </View>
              )}
              {cartPriced.map((c, i) => (
                <View key={`${c.food.id}-${i}`} style={styles.placeOrderItemRow}>
                  <Text style={styles.placeOrderItemName}>
                    {c.qty}× {c.food.item_name}
                    {(c.modifiers ?? []).length > 0 && ` (${(c.modifiers ?? []).map((m) => m.name).join(', ')})`}
                  </Text>
                  <Text style={styles.placeOrderItemTotal}>
                    {fmtMoney(lineTotal(c))}
                  </Text>
                </View>
              ))}
              <View style={styles.placeOrderTotals}>
                <Row label="Subtotal" value={subtotal} format={fmtMoney} />
                <Row label="Service charge" value={APP_SERVICE_CHARGE_VALUE} format={fmtMoney} />
                <View style={styles.placeOrderTotalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{fmtMoney(total)}</Text>
                </View>
              </View>
            </ScrollView>
            <TouchableOpacity
              style={[styles.confirmPayBtn, shadowMd]}
              onPress={handleConfirmAndPay}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmPayBtnText}>Confirm Order</Text>
              <Icon name="check" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Variant sheet — hero + curved body (delivery-style) + segmented rows + qty footer */}
      <Modal
        visible={variantPickFood !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setVariantPickFood(null)}
      >
        <View style={styles.variantModalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVariantPickFood(null)} />
          <Animated.View
            entering={FadeInDown.duration(340).springify().damping(20)}
            style={[styles.variantFullSheet, { height: screenHeight * 0.88 }]}
            pointerEvents="box-none"
          >
            <View style={[styles.variantHero, { paddingTop: Math.max(insets.top, 12) + 8 }]}>
              <TouchableOpacity
                onPress={() => setVariantPickFood(null)}
                hitSlop={14}
                style={[styles.variantHeroClose, { top: Math.max(insets.top, 8) + 4 }]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="chevron-down" size={26} color="rgba(255,255,255,0.92)" />
              </TouchableOpacity>
              <View style={styles.variantHeroImageShell}>
                {variantHeroUri ? (
                  <Image
                    source={{ uri: variantHeroUri }}
                    style={styles.variantHeroImage}
                    resizeMode="contain"
                    fadeDuration={Platform.OS === 'android' ? 0 : undefined}
                    onError={() => setVariantHeroImageFailed(true)}
                  />
                ) : (
                  <View style={styles.variantHeroPlaceholder}>
                    <Text style={styles.variantHeroMonogramText} allowFontScaling={false}>
                      {variantHeroMonogram}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.variantHeroTitle} numberOfLines={2}>
                {variantPickFood?.item_name ?? ''}
              </Text>
              {(variantPickFood?.description ?? '').trim().length > 0 ? (
                <Text style={styles.variantHeroSubtitle} numberOfLines={2}>
                  {(variantPickFood?.description ?? '').trim()}
                </Text>
              ) : null}
              <Text style={styles.variantHeroPrice}>{fmtMoney(variantSheetUnitPrice)}</Text>
            </View>

            <View style={styles.variantSheetBody}>
              <View style={styles.variantSheetHandleLight} accessibilityLabel="Sheet" />
              <Text style={styles.variantOptionsSectionTitle}>Choose options</Text>
              <ScrollView
                style={styles.variantOptionsScroll}
                contentContainerStyle={styles.variantOptionsScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {(variantPickFood?.variantGroups ?? []).map((g) => (
                  <View key={g.id} style={styles.variantGroupBlock}>
                    <Text style={styles.variantGroupTitle}>{g.name}</Text>
                    {g.options.length <= VARIANT_SEGMENT_MAX ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.variantChipScroll}
                      >
                        {g.options.map((opt) => {
                          const selected = variantSelections[g.id] === opt.id;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[styles.variantSegmentChip, selected && styles.variantSegmentChipSelected]}
                              onPress={() => setVariantSelections((prev) => ({ ...prev, [g.id]: opt.id }))}
                              activeOpacity={0.88}
                            >
                              <Text
                                style={[styles.variantSegmentChipName, selected && styles.variantSegmentChipNameSelected]}
                                numberOfLines={2}
                              >
                                {opt.name}
                              </Text>
                              <Text
                                style={[
                                  styles.variantSegmentChipDelta,
                                  selected && styles.variantSegmentChipDeltaSelected,
                                ]}
                              >
                                {formatPriceDelta(opt.priceDelta, posCurrency)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <View style={styles.variantRowList}>
                        {g.options.map((opt, optIdx) => {
                          const selected = variantSelections[g.id] === opt.id;
                          const isLastInGroup = optIdx === g.options.length - 1;
                          return (
                            <TouchableOpacity
                              key={opt.id}
                              style={[
                                styles.variantRow,
                                selected && styles.variantRowSelected,
                                isLastInGroup && styles.variantRowLast,
                              ]}
                              onPress={() => setVariantSelections((prev) => ({ ...prev, [g.id]: opt.id }))}
                              activeOpacity={0.88}
                            >
                              <View
                                style={[
                                  styles.variantRadioOuter,
                                  selected && styles.variantRadioOuterSelected,
                                ]}
                              >
                                {selected ? <View style={styles.variantRadioInner} /> : null}
                              </View>
                              <Text style={styles.variantRowName} numberOfLines={2}>
                                {opt.name}
                              </Text>
                              <Text style={styles.variantRowDelta}>
                                {formatPriceDelta(opt.priceDelta, posCurrency)}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              <View style={[styles.variantFooterBar, { paddingBottom: insets.bottom + 14 }]}>
                <View style={styles.variantFooterRow}>
                  <View style={styles.variantStepperPill}>
                    <Text style={styles.variantStepperLabel}>Qty</Text>
                    <TouchableOpacity
                      onPress={() => setVariantSheetQty((q) => Math.max(1, q - 1))}
                      style={styles.variantStepperBtn}
                      hitSlop={10}
                    >
                      <Icon name="minus" size={20} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.variantStepperValue}>{variantSheetQty}</Text>
                    <TouchableOpacity
                      onPress={() => setVariantSheetQty((q) => q + 1)}
                      style={styles.variantStepperBtn}
                      hitSlop={10}
                    >
                      <Icon name="plus" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.variantFooterCta, shadowAccent]}
                    onPress={confirmVariantPick}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.variantFooterCtaText} numberOfLines={1}>
                      Add to order · {fmtMoney(variantSheetLineTotal)}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Modifiers modal — add / remove modifiers for selected cart item (like web) */}
      <Modal
        visible={modifiersCartIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setModifiersCartIndex(null)}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setModifiersCartIndex(null)} />
        <View style={styles.modifiersModalOverlay} pointerEvents="box-none">
          <Animated.View
            entering={FadeInDown.duration(320).springify().damping(20)}
            style={[styles.modifiersModalCard, { paddingBottom: insets.bottom + 24 }]}
            pointerEvents="box-none"
          >
            <View style={styles.modifiersModalHeader}>
              <View>
                <Text style={styles.modifiersModalTitle}>Modifiers</Text>
                <Text style={styles.modifiersModalSubtitle}>
                  {modifiersCartIndex !== null && cartPriced[modifiersCartIndex]
                    ? cartPriced[modifiersCartIndex].food.item_name
                    : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModifiersCartIndex(null)} hitSlop={12} style={styles.modifiersModalClose}>
                <Icon name="x" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modifiersModalScroll} showsVerticalScrollIndicator={false}>
              {modifiersCartIndex !== null && cart[modifiersCartIndex] && (() => {
                const cartItem = cartPriced[modifiersCartIndex];
                const currentMods = cartItem.modifiers ?? [];
                const addMod = (m: Modifier) => {
                  setCartItemModifiers({ index: modifiersCartIndex, modifiers: [...currentMods, m] });
                };
                const removeMod = (m: Modifier) => {
                  setCartItemModifiers({ index: modifiersCartIndex, modifiers: currentMods.filter((x) => x.id !== m.id) });
                };
                const available = modifiers.filter((m) => !currentMods.some((x) => x.id === m.id));
                return (
                  <>
                    <Text style={styles.modifiersSectionLabel}>On this item ({currentMods.length})</Text>
                    {currentMods.length === 0 ? (
                      <Text style={styles.modifiersEmpty}>No modifiers added. Add some below.</Text>
                    ) : (
                      currentMods.map((m) => (
                        <View key={m.id} style={styles.modifiersRow}>
                          <View style={styles.modifiersRowLeft}>
                            <Text style={styles.modifiersRowName}>{m.name}</Text>
                            <Text style={styles.modifiersRowPrice}>{m.price > 0 ? `+${fmtMoney(m.price)}` : 'Free'}</Text>
                          </View>
                          <TouchableOpacity style={styles.modifiersRemoveBtn} onPress={() => removeMod(m)}>
                            <Icon name="trash-2" size={16} color="#dc2626" />
                            <Text style={styles.modifiersRemoveText}>Remove</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                    <Text style={[styles.modifiersSectionLabel, { marginTop: 20 }]}>Add modifier</Text>
                    {available.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={styles.modifiersAddRow}
                        onPress={() => addMod(m)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.modifiersRowLeft}>
                          <Text style={styles.modifiersRowName}>{m.name}</Text>
                          <Text style={styles.modifiersRowPrice}>{m.price > 0 ? `+${fmtMoney(m.price)}` : 'Free'}</Text>
                        </View>
                        <View style={styles.modifiersAddBtn}>
                          <Icon name="plus" size={16} color="#fff" />
                          <Text style={styles.modifiersAddBtnText}>Add</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                    {available.length === 0 && <Text style={styles.modifiersEmpty}>All modifiers added.</Text>}
                  </>
                );
              })()}
            </ScrollView>
            <TouchableOpacity
              style={styles.modifiersDoneBtn}
              onPress={() => setModifiersCartIndex(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.modifiersDoneBtnText}>Done</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function Row({
  label,
  value,
  format,
}: {
  label: string;
  value: number;
  format?: (n: number) => string;
}) {
  const display = format ? format(value) : `$${value.toFixed(2)}`;
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{display}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.posCanvas,
  },
  toastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.posAccentDark,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    ...shadowAccent,
  },
  toastIconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  toastSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.92)',
    marginTop: 3,
    lineHeight: 18,
  },
  menuSectionHeader: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.borderLight,
  },
  menuSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  menuSectionTitle: {
    ...typography.h2,
    fontSize: 22,
    fontWeight: '800',
    color: themeColors.text,
    letterSpacing: -0.6,
  },
  menuCountPill: {
    minWidth: 28,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: themeColors.posAccentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuCountPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: themeColors.posAccentDark,
    letterSpacing: -0.2,
  },
  menuSectionMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: themeColors.textMuted,
    lineHeight: 18,
  },
  categoryBar: {
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: spacing.md,
    marginBottom: POS_HEADER_GAP,
    borderBottomWidth: 0,
  },
  categoryBarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: POS_HEADER_ROW_HEIGHT,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
    paddingRight: 6,
  },
  categoryBarHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: themeColors.text,
    letterSpacing: -0.25,
    lineHeight: 20,
  },
  categoryHeaderAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 8,
  },
  categoryHeaderActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT,
    lineHeight: 20,
  },
  posChromeBulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: POS_HEADER_GAP,
  },
  posChromeBulkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    paddingVertical: 4,
    paddingRight: 4,
  },
  posChromeBulkTrail: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '600',
    color: themeColors.textSecondary,
    textAlign: 'right',
    letterSpacing: -0.15,
  },
  posChromeSection: {
    marginBottom: POS_HEADER_GAP,
  },
  posChromeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: POS_HEADER_ROW_HEIGHT,
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
    paddingRight: 6,
  },
  posChromeHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: themeColors.text,
    letterSpacing: -0.25,
    lineHeight: 20,
  },
  posChromeInner: {
    marginBottom: 0,
  },
  posChromeCollapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: POS_HEADER_ROW_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 14,
    gap: 12,
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  categoryCollapseBtn: {
    padding: spacing.xxs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: spacing.sm,
  },
  categoryGridCell: {
    padding: 6,
  },
  categoryGridTile: {
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  categoryGridTileActive: {
    borderWidth: 2,
    borderColor: ACCENT,
    backgroundColor: themeColors.posAccentSoft,
  },
  categoryGridEmoji: {
    fontSize: 30,
    lineHeight: 36,
    textAlign: 'center',
  },
  categoryGridLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 14,
    paddingHorizontal: 2,
  },
  categoryGridLabelActive: {
    color: themeColors.posAccentDark,
    fontWeight: '800',
  },
  categoryCollapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: POS_HEADER_ROW_HEIGHT,
    paddingVertical: 0,
    paddingHorizontal: 14,
    gap: 12,
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  categoryCollapsedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: themeColors.posAccentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCollapsedEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  categoryCollapsedTextCol: {
    flex: 1,
    minWidth: 0,
  },
  categoryCollapsedKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: themeColors.textSubtle,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  categoryCollapsedValue: {
    fontSize: 15,
    fontWeight: '600',
    color: themeColors.text,
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  categoryScrollContent: {
    paddingRight: spacing.md,
  },
  categoryPillWrap: {
    marginRight: spacing.md,
  },
  categoryPill: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
    minWidth: 72,
    maxWidth: 88,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  categoryPillActive: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  categoryIconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: themeColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  categoryIconTileActive: {
    backgroundColor: themeColors.primaryMuted,
    borderColor: ACCENT,
    borderWidth: 2,
  },
  categoryPillEmoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  categoryPillLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: themeColors.textSecondary,
    textAlign: 'center',
    maxWidth: 88,
  },
  categoryPillLabelActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  orderTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: POS_HEADER_ROW_HEIGHT,
    marginBottom: POS_HEADER_GAP,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
    backgroundColor: themeColors.surface,
    borderRadius: 999,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: POS_HEADER_ROW_HEIGHT - 8,
    paddingVertical: 0,
    borderRadius: 999,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  orderTypeBtnActive: {
    backgroundColor: themeColors.posAccentMuted,
  },
  orderTypeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: themeColors.textMuted,
    lineHeight: 20,
  },
  orderTypeLabelActive: {
    color: themeColors.posAccentDark,
    fontWeight: '700',
  },
  orderTypeEmoji: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  contextCard: {
    minHeight: POS_HEADER_ROW_HEIGHT,
    marginBottom: POS_HEADER_GAP,
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    borderWidth: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  contextRowCombined: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: POS_HEADER_ROW_HEIGHT,
  },
  contextCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 0,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 10,
    minWidth: 0,
  },
  contextCellMuted: {
    opacity: 0.88,
  },
  contextVerticalRule: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: themeColors.borderLight,
    alignSelf: 'stretch',
    marginVertical: 12,
  },
  contextIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: themeColors.posAccentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextLabelCol: {
    flex: 1,
    minWidth: 0,
  },
  contextFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: themeColors.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  tableDropdown: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xxs,
    gap: spacing.xs,
  },
  tableDropdownText: {
    ...typography.bodySemibold,
    fontSize: 15,
    lineHeight: 20,
    color: themeColors.text,
  },
  tableDropdownPlaceholder: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    color: themeColors.textSubtle,
  },
  tableModalBackdrop: {
    flex: 1,
    backgroundColor: themeColors.overlay,
    justifyContent: 'center',
    alignItems: 'stretch',
    padding: spacing.xl,
  },
  tableModalContent: {
    backgroundColor: themeColors.surface,
    borderRadius: radius.md,
    maxHeight: '70%',
  },
  tableModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  tableModalTitle: {
    ...typography.h2,
    color: themeColors.text,
  },
  tableModalScroll: {
    maxHeight: 320,
    padding: spacing.sm,
  },
  tableOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    backgroundColor: themeColors.surfaceSecondary,
  },
  tableOptionActive: {
    backgroundColor: ACCENT,
  },
  tableOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  tableOptionTextActive: {
    color: '#fff',
  },
  tableGateRoot: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  tableGateCard: {
    position: 'relative',
    backgroundColor: 'rgba(30, 41, 59, 0.97)',
    borderRadius: radius.xl + 4,
    borderWidth: 1,
    borderColor: 'rgba(94, 234, 212, 0.14)',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: '90%',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.12,
        shadowRadius: 40,
      },
      android: { elevation: 24 },
    }),
  },
  tableGateGlowTop: {
    position: 'absolute',
    top: -80,
    left: '15%',
    right: '15%',
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(13, 148, 136, 0.18)',
  },
  tableGateGlowBlob: {
    position: 'absolute',
    top: 40,
    right: -50,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(8, 145, 178, 0.1)',
  },
  gateStepsRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
    zIndex: 1,
  },
  gateStepsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  gateStepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  gateStepDotActive: {
    backgroundColor: ACCENT,
    borderColor: 'rgba(45, 212, 191, 0.5)',
    transform: [{ scale: 1.15 }],
  },
  gateStepLine: {
    width: 36,
    height: 2,
    marginHorizontal: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
  },
  gateStepLineActive: {
    backgroundColor: 'rgba(13, 148, 136, 0.65)',
  },
  gateStepsLabel: {
    ...typography.caption,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  gateStepsLabelSingle: {
    ...typography.caption,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  gateChangeTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    zIndex: 1,
  },
  gateChangeTableText: {
    ...typography.bodyMedium,
    color: ACCENT,
    fontSize: 15,
    fontWeight: '600',
  },
  tableGateHero: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    zIndex: 1,
  },
  tableGatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 148, 136, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.22)',
    marginBottom: spacing.md,
  },
  tableGatePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2dd4bf',
  },
  tableGatePillText: {
    ...typography.caption,
    color: '#99f6e4',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  tableGateHeroIconWrap: {
    marginBottom: spacing.md,
  },
  tableGateHeroRingOuter: {
    padding: 3,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableGateHeroRing: {
    width: 76,
    height: 76,
    borderRadius: 25,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.45,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  tableGateTitle: {
    ...typography.h1,
    color: '#f8fafc',
    fontSize: 24,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  tableGateSubtitle: {
    ...typography.body,
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: spacing.xs,
    maxWidth: 320,
  },
  tableGateLoading: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    gap: spacing.md,
    zIndex: 1,
  },
  tableGateLoadingText: {
    ...typography.body,
    color: 'rgba(148, 163, 184, 0.9)',
  },
  tableGateEmpty: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    zIndex: 1,
  },
  tableGateEmptyIcon: {
    marginBottom: spacing.md,
  },
  tableGateEmptyText: {
    ...typography.body,
    color: 'rgba(148, 163, 184, 0.95)',
    textAlign: 'center',
    lineHeight: 22,
  },
  tableGateList: {
    maxHeight: 340,
    zIndex: 1,
  },
  tableGateListContent: {
    paddingBottom: spacing.xs,
  },
  tableGateRow: {
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  tableGateCell: {
    flex: 1,
    minWidth: 0,
  },
  tableGateTileWrap: {
    flex: 1,
  },
  tableGateTile: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.55)',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 102,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  tableGateTileIconRow: {
    marginBottom: spacing.sm,
  },
  tableGateTileIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(13, 148, 136, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(45, 212, 191, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGateEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  tableGateTileNumber: {
    ...typography.h2,
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tableGateTileCaption: {
    ...typography.caption,
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  tableGateDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    marginVertical: spacing.md,
    zIndex: 1,
  },
  tableGateAlt: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    zIndex: 1,
  },
  tableGateAltInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.28)',
  },
  tableGateAltIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(13, 148, 136, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableGateAltTextCol: {
    flex: 1,
    minWidth: 0,
  },
  tableGateAltTitle: {
    ...typography.bodySemibold,
    color: '#ecfdf5',
    fontSize: 16,
    marginBottom: 2,
  },
  tableGateAltSub: {
    ...typography.caption,
    color: 'rgba(148, 163, 184, 0.9)',
    fontSize: 12,
  },
  searchRowOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: POS_HEADER_ROW_HEIGHT,
    marginBottom: POS_HEADER_GAP,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    height: POS_HEADER_ROW_HEIGHT - 8,
    maxHeight: POS_HEADER_ROW_HEIGHT - 8,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  searchWrapFocused: {
    borderColor: themeColors.posAccent,
    borderWidth: 1.5,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  search: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    color: themeColors.text,
    paddingVertical: spacing.xxs,
  },
  searchClear: {
    marginLeft: spacing.xs,
    padding: spacing.xxs,
  },
  searchCollapseBtn: {
    marginLeft: spacing.xs,
    padding: spacing.xxs,
    justifyContent: 'center',
  },
  searchCollapsedBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    height: POS_HEADER_ROW_HEIGHT - 8,
    paddingHorizontal: 14,
    paddingVertical: 0,
    backgroundColor: themeColors.surface,
    borderRadius: 18,
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  searchCollapsedMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  searchCollapsedText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
    color: themeColors.textSecondary,
    minWidth: 0,
  },
  searchCollapsedClear: {
    padding: spacing.xxs,
    marginRight: spacing.xxs,
  },
  searchCollapsedChevron: {
    padding: spacing.xxs,
    marginLeft: spacing.xxs,
  },
  searchFilterBtn: {
    width: POS_HEADER_ROW_HEIGHT - 8,
    height: POS_HEADER_ROW_HEIGHT - 8,
    borderRadius: 16,
    backgroundColor: themeColors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  searchFilterBtnActive: {
    backgroundColor: themeColors.posAccentMuted,
    borderColor: ACCENT,
    borderWidth: 1.5,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingBottom: 128,
  },
  floatingCartBar: {
    position: 'absolute',
    minHeight: 58,
    borderRadius: 999,
    backgroundColor: FLOATING_BAR_BG,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  floatingCartBarEmpty: {
    alignSelf: 'center',
    width: 58,
    height: 58,
    minHeight: 58,
    borderRadius: 29,
    paddingHorizontal: 0,
  },
  floatingCartBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingLeft: 20,
    paddingRight: 8,
  },
  floatingCartBarTextCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  floatingCartBarKicker: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(248,250,252,0.72)',
    letterSpacing: 0.2,
  },
  floatingCartBarTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
    letterSpacing: -0.4,
  },
  floatingCartBarCtaCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartBarEmptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 29,
  },
  cartSheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cartSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  cartSheet: {
    backgroundColor: themeColors.surface,
    borderTopLeftRadius: radius.xl + 6,
    borderTopRightRadius: radius.xl + 6,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.border,
    ...shadowMd,
  },
  cartSheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: themeColors.textSubtle,
    opacity: 0.6,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  cartSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  cartSheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  cartSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  cartSheetSubtitle: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '600',
    color: themeColors.textMuted,
    marginTop: 4,
  },
  cartBadgeMargin: {
    marginLeft: 0,
  },
  cartSheetCloseBtn: {
    marginLeft: 'auto',
    marginTop: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: themeColors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToastWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    zIndex: 50,
    alignItems: 'center',
  },
  addToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: themeColors.dark,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  addToastIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addToastTextCol: {
    flex: 1,
    minWidth: 0,
  },
  addToastKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(148, 163, 184, 0.95)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  addToastTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  cartSheetScroll: {
    flex: 1,
  },
  cartSheetScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  foodList: {
    flex: 1,
    paddingTop: spacing.xs,
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  foodGridRow: {
    paddingHorizontal: 0,
  },
  foodCardWrapper: {
    padding: 8,
    minHeight: 0,
  },
  priceChip: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
    zIndex: 1,
  },
  priceChipText: {
    ...typography.price,
    fontSize: 13,
    color: themeColors.primaryContrast,
  },
  foodIconArea: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 72,
    borderRadius: radius.md,
    backgroundColor: themeColors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: themeColors.borderLight,
    overflow: 'hidden',
    ...shadowSm,
  },
  foodImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
  },
  foodPlaceholderText: {
    fontSize: 18,
    fontWeight: '700',
    color: themeColors.textSecondary,
    letterSpacing: 0.5,
  },
  foodEmoji: {
    fontSize: 34,
    textAlign: 'center',
  },
  foodName: {
    ...typography.bodySemibold,
    fontSize: 14,
    color: themeColors.text,
    lineHeight: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    textAlign: 'center',
  },
  cartTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: themeColors.text,
    letterSpacing: -0.5,
  },
  cartEmptyEmoji: {
    fontSize: 44,
    textAlign: 'center',
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  cartName: {
    flex: 1,
    ...typography.bodyMedium,
    color: themeColors.text,
  },
  cartQtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  qtyBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: themeColors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
    }),
  },
  cartQty: {
    ...typography.price,
    minWidth: 28,
    textAlign: 'center',
    color: themeColors.text,
  },
  cartLineTotal: {
    ...typography.price,
    color: ACCENT,
    marginLeft: spacing.sm,
  },
  cartRowWrap: {
    marginBottom: 0,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.borderLight,
  },
  cartRowLeft: {
    flex: 1,
    minWidth: 0,
  },
  modifierChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  modifierChip: {
    backgroundColor: themeColors.posAccentMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xxs,
    borderRadius: radius.xs,
  },
  modifierChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: ACCENT,
  },
  modifiersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: themeColors.posAccentMuted,
    borderRadius: radius.xs,
  },
  modifiersBtnText: {
    ...typography.caption,
    color: ACCENT,
  },
  cartRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.borderLight,
  },
  removeItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  removeItemBtnText: {
    ...typography.caption,
    color: '#dc2626',
  },
  notesWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: themeColors.surfaceSecondary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: themeColors.border,
    gap: spacing.sm,
  },
  notesInput: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
    paddingVertical: spacing.xxs,
    minHeight: 40,
  },
  totals: {
    borderTopWidth: 2,
    borderTopColor: themeColors.borderLight,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  summaryLabel: {
    ...typography.body,
    color: themeColors.textMuted,
  },
  summaryValue: {
    ...typography.bodySemibold,
    color: themeColors.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
  totalLabel: {
    ...typography.h3,
    fontSize: 17,
    color: themeColors.text,
  },
  totalValue: {
    ...typography.total,
    color: ACCENT,
  },
  addMoreFromCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.35)',
    backgroundColor: themeColors.surface,
  },
  addMoreFromCartBtnText: {
    ...typography.bodySemibold,
    fontSize: 16,
    color: ACCENT,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: spacing.md + 2,
    marginBottom: spacing.sm,
  },
  submitBtnText: {
    color: themeColors.primaryContrast,
    ...typography.bodySemibold,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  clearBtnText: {
    ...typography.bodyMedium,
    color: themeColors.textSubtle,
  },
  placeOrderOverlay: {
    flex: 1,
    backgroundColor: themeColors.overlay,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  placeOrderCard: {
    backgroundColor: themeColors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  placeOrderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  placeOrderTitle: {
    ...typography.h1,
    fontSize: 20,
    color: themeColors.text,
  },
  placeOrderScroll: {
    maxHeight: 320,
    marginBottom: spacing.md,
  },
  placeOrderSectionLabel: {
    ...typography.caption,
    color: themeColors.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  placeOrderItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.borderLight,
  },
  placeOrderItemName: {
    ...typography.body,
    color: themeColors.text,
    flex: 1,
  },
  placeOrderItemTotal: {
    ...typography.price,
    color: ACCENT,
    marginLeft: spacing.sm,
  },
  placeOrderTotals: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: themeColors.borderLight,
  },
  placeOrderTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
  },
  confirmPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: ACCENT,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  confirmPayBtnText: {
    color: themeColors.primaryContrast,
    ...typography.bodySemibold,
    fontSize: 16,
  },
  modifiersModalOverlay: {
    flex: 1,
    backgroundColor: themeColors.overlay,
    justifyContent: 'flex-end',
  },
  modifiersModalCard: {
    backgroundColor: themeColors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    maxHeight: '88%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: themeColors.border,
  },
  variantModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: themeColors.overlay,
  },
  variantFullSheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: themeColors.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  variantHero: {
    backgroundColor: themeColors.dark,
    paddingHorizontal: spacing.lg,
    paddingBottom: 20,
    alignItems: 'center',
  },
  variantHeroClose: {
    position: 'absolute',
    left: spacing.md,
    zIndex: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantHeroImageShell: {
    width: '100%',
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  variantHeroImage: {
    width: '100%',
    height: '100%',
  },
  variantHeroPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  variantHeroMonogramText: {
    fontSize: 44,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
  },
  variantHeroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  variantHeroSubtitle: {
    ...typography.body,
    fontSize: 14,
    color: 'rgba(248,250,252,0.55)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  variantHeroPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: ACCENT,
    marginTop: 14,
    letterSpacing: -0.5,
  },
  variantSheetBody: {
    flex: 1,
    backgroundColor: themeColors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -22,
    paddingTop: 10,
    paddingHorizontal: 0,
  },
  variantSheetHandleLight: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: themeColors.border,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  variantOptionsSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: themeColors.text,
    letterSpacing: -0.35,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  variantOptionsScroll: {
    flex: 1,
    minHeight: 80,
  },
  variantOptionsScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  variantChipScroll: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
    paddingRight: spacing.lg,
  },
  variantSegmentChip: {
    maxWidth: 160,
    minWidth: 100,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: themeColors.surfaceSecondary,
    borderWidth: 1.5,
    borderColor: themeColors.border,
  },
  variantSegmentChipSelected: {
    borderColor: ACCENT,
    backgroundColor: themeColors.posAccentMuted,
  },
  variantSegmentChipName: {
    fontSize: 15,
    fontWeight: '700',
    color: themeColors.text,
  },
  variantSegmentChipNameSelected: {
    color: themeColors.posAccentDark,
  },
  variantSegmentChipDelta: {
    fontSize: 12,
    fontWeight: '700',
    color: themeColors.textMuted,
    marginTop: 6,
  },
  variantSegmentChipDeltaSelected: {
    color: ACCENT,
  },
  variantFooterBar: {
    backgroundColor: FLOATING_BAR_BG,
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  variantFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  variantStepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  variantStepperLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(248,250,252,0.75)',
    marginRight: 4,
  },
  variantStepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantStepperValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    minWidth: 28,
    textAlign: 'center',
  },
  variantFooterCta: {
    flex: 1,
    minWidth: 0,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantFooterCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: themeColors.primaryContrast,
    letterSpacing: -0.2,
  },
  modifiersModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modifiersModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: themeColors.text,
    letterSpacing: -0.35,
    lineHeight: 26,
  },
  modifiersModalSubtitle: {
    ...typography.body,
    color: themeColors.textMuted,
    marginTop: 8,
  },
  modifiersModalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: themeColors.surfaceTertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifiersModalScroll: {
    maxHeight: 360,
    marginBottom: spacing.md,
  },
  modifiersSectionLabel: {
    ...typography.captionMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    color: themeColors.textSubtle,
  },
  modifiersEmpty: {
    ...typography.body,
    color: themeColors.textSubtle,
    marginBottom: spacing.sm,
  },
  modifiersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: themeColors.surfaceSecondary,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  modifiersRowLeft: {
    flex: 1,
  },
  modifiersRowName: {
    ...typography.bodySemibold,
    color: themeColors.text,
  },
  modifiersRowPrice: {
    ...typography.caption,
    color: themeColors.textMuted,
    marginTop: 2,
  },
  modifiersRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  modifiersRemoveText: {
    ...typography.caption,
    color: themeColors.error,
  },
  modifiersAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: themeColors.surface,
    borderRadius: radius.sm,
    marginBottom: spacing.xs,
    borderWidth: 1.5,
    borderColor: themeColors.border,
  },
  modifiersAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.xs,
    backgroundColor: ACCENT,
  },
  modifiersAddBtnText: {
    ...typography.caption,
    color: themeColors.primaryContrast,
  },
  variantGroupTitle: {
    ...typography.captionMuted,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: spacing.xs,
    color: themeColors.textSubtle,
  },
  modifiersDoneBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifiersDoneBtnText: {
    ...typography.bodySemibold,
    color: themeColors.primaryContrast,
  },
  variantGroupBlock: {
    marginBottom: spacing.lg,
  },
  variantRowList: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: themeColors.border,
    overflow: 'hidden',
    backgroundColor: themeColors.surface,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.borderLight,
    backgroundColor: themeColors.surface,
  },
  variantRowSelected: {
    backgroundColor: themeColors.surfaceSecondary,
  },
  variantRowLast: {
    borderBottomWidth: 0,
  },
  variantRadioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: themeColors.border,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantRadioOuterSelected: {
    borderColor: ACCENT,
  },
  variantRadioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: ACCENT,
  },
  variantRowName: {
    ...typography.bodySemibold,
    flex: 1,
    fontSize: 16,
    color: themeColors.text,
    paddingRight: spacing.sm,
  },
  variantRowDelta: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: themeColors.textMuted,
  },
});
