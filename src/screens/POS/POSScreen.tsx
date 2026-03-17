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
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../../context/AppContext';
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
import { DEMO_FOOD_ITEMS, CATEGORIES, DEMO_MODIFIERS } from '../../constants/demoData';
import { storeConfig } from '../../constants/storeConfig';
import { getTables, type TableItem } from '../../services/tablesService';
import { getCustomers, type CustomerItem } from '../../services/customersService';
import type { FoodItem } from '../../constants/demoData';
import { colors as themeColors, spacing, radius, typography, shadows } from '../../theme';
import { Badge, EmptyState, PressableScale } from '../../components/ui';
import {
  CATEGORY_EMOJI,
  getFoodEmoji,
  ORDER_TYPE_EMOJI,
  FEATHER_ICONS,
} from '../../constants/appIcons';

const ORDER_TYPES: { id: OrderType; label: string }[] = [
  { id: 'DINE_IN', label: 'Dine In' },
  { id: 'TAKEAWAY', label: 'Pick Up' },
  { id: 'DELIVERY', label: 'Delivery' },
];

const ACCENT = themeColors.primary;
const shadowMd = shadows.md;
const shadowSm = shadows.sm;
const shadowAccent = shadows.accent(ACCENT);

const FOOD_LIST_INITIAL_NUM = 12;
const FOOD_LIST_WINDOW_SIZE = 8;

const FoodCard = React.memo(function FoodCard({
  food,
  onAdd,
  index = 0,
}: {
  food: FoodItem;
  onAdd: (f: FoodItem) => void;
  index?: number;
}) {
  const foodEmoji = getFoodEmoji(food.category);
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 35).duration(280).springify().damping(18)}
      style={styles.foodCardOuter}
    >
      <PressableScale activeScale={0.96} style={styles.foodCard} onPress={() => onAdd(food)}>
        <View style={styles.priceChip}>
          <Text style={styles.priceChipText}>${food.price.toFixed(2)}</Text>
        </View>
        <View style={styles.foodIconArea}>
          <Text style={styles.foodEmoji} allowFontScaling={false}>
            {foodEmoji}
          </Text>
        </View>
        <Text style={styles.foodName} numberOfLines={2}>
          {food.item_name}
        </Text>
      </PressableScale>
    </Animated.View>
  );
});

export default function POSScreen() {
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
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { numColumns, cartSheetHeightRatio, horizontalPadding, maxContentWidth, isTablet } = useResponsive();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showPlaceOrder, setShowPlaceOrder] = useState(false);
  const [showOrderPlacedToast, setShowOrderPlacedToast] = useState(false);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [modifiersCartIndex, setModifiersCartIndex] = useState<number | null>(null);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [tableDropdownOpen, setTableDropdownOpen] = useState(false);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const listRef = useRef<FlatList<FoodItem> | null>(null);

  useEffect(() => {
    if (orderType === 'DINE_IN') {
      setTablesLoading(true);
      getTables(storeConfig.tablesApiBase)
        .then(setTables)
        .finally(() => setTablesLoading(false));
    }
  }, [orderType]);

  useEffect(() => {
    setCustomersLoading(true);
    getCustomers(storeConfig.customersApiBase)
      .then(setCustomers)
      .finally(() => setCustomersLoading(false));
  }, []);

  const lineTotal = useCallback((c: CartItem) => {
    const base = c.food.price * c.qty;
    const modTotal = (c.modifiers ?? []).reduce((s, m) => s + m.price * c.qty, 0);
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

  const closeCartSheet = () => {
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
  };

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

  const filteredItems = useMemo(() => {
    let list =
      category === 'All'
        ? DEMO_FOOD_ITEMS
        : DEMO_FOOD_ITEMS.filter((f) => f.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.item_name.toLowerCase().includes(q) ||
          (f.description || '').toLowerCase().includes(q)
      );
    }
    return list.filter((f) => f.status);
  }, [category, search]);

  const subtotal = getSubtotal(cart);
  const total = getTotal(cart, discountPercent, chargePercent, taxPercent);

  const handleAddItem = useCallback(
    (food: FoodItem) => {
      addToCart({ food, qty: 1 });
    },
    [addToCart]
  );

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      Alert.alert('Empty cart', 'Add items before placing order.');
      return;
    }
    setShowPlaceOrder(true);
  };

  const handleConfirmAndPay = () => {
    const enabled: PaymentMethod[] = storeConfig.enabledPaymentMethods ?? ['CASH'];
    const allowedMethod: PaymentMethod = enabled.length > 0 && enabled.includes(paymentMethod) ? paymentMethod : (enabled[0] ?? 'CASH');
    const modSum = (c: CartItem) => (c.modifiers ?? []).reduce((s, m) => s + m.price, 0);
    const items = cart.map((c) => ({
      id: c.food.id,
      name: c.food.item_name,
      price: c.food.price + modSum(c),
      qty: c.qty,
    }));
    const orderId = generateOrderId();
    const createdAt = new Date().toISOString();
    const order: CompletedOrder = {
      id: orderId,
      createdAt,
      items,
      total,
      paymentMethod: allowedMethod,
      orderType,
      tableNumber: tableNumber || undefined,
      customerName: customerName || undefined,
      orderNotes: orderNotes?.trim() || undefined,
      status: 'PENDING',
    };
    addCompletedOrder(order);
    setShowPlaceOrder(false);
    setShowOrderPlacedToast(true);
    setTimeout(() => navigation.navigate('Orders' as never), 2500);
  };

  const renderFoodItem = useCallback(
    ({ item, index }: { item: FoodItem; index: number }) => (
      <View style={[styles.foodCardWrapper, { width: `${100 / numColumns}%` }]}>
        <FoodCard food={item} onAdd={handleAddItem} index={index} />
      </View>
    ),
    [handleAddItem, numColumns]
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
            ${lineTotal(item).toFixed(2)}
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

  return (
    <View style={[styles.container, isTablet && { alignItems: 'center', maxWidth: maxContentWidth, width: '100%' }]}>
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
      <View style={[styles.searchWrap, shadowSm, { marginHorizontal: horizontalPadding }]}>
        <Icon name={FEATHER_ICONS.search} size={20} color={themeColors.textSubtle} style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder="Search items..."
          placeholderTextColor={themeColors.textSubtle}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={[styles.categoryBar, shadowSm, { paddingHorizontal: horizontalPadding }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map((c, idx) => {
            const emoji = CATEGORY_EMOJI[c.id] ?? '🍽️';
            const isActive = category === c.id;
            return (
              <Animated.View
                key={c.id}
                entering={FadeInRight.delay(idx * 45).duration(260).springify().damping(18)}
                style={styles.categoryPillWrap}
              >
                <PressableScale
                  activeScale={0.97}
                  style={[
                    styles.categoryPill,
                    isActive && styles.categoryPillActive,
                  ]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={styles.categoryPillEmoji} allowFontScaling={false}>
                    {emoji}
                  </Text>
                  <Text
                    style={[
                      styles.categoryPillLabel,
                      isActive && styles.categoryPillLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {c.label}
                  </Text>
                </PressableScale>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      <View style={[styles.orderTypeRow, { paddingHorizontal: horizontalPadding }]}>
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

      {orderType === 'DINE_IN' && (
        <Animated.View entering={FadeIn.duration(200)} style={[styles.tableRow, { marginHorizontal: horizontalPadding }]}>
          <Text style={styles.tableRowEmoji} allowFontScaling={false}>🪑</Text>
          <TouchableOpacity
            style={styles.tableDropdown}
            onPress={() => setTableDropdownOpen(true)}
            activeOpacity={0.7}
          >
            <Text style={tableNumber ? styles.tableDropdownText : styles.tableDropdownPlaceholder} numberOfLines={1}>
              {tablesLoading ? 'Loading...' : tableNumber || 'Select table'}
            </Text>
            <Icon name="chevron-down" size={20} color={themeColors.textMuted} />
          </TouchableOpacity>
          <Modal
            visible={tableDropdownOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setTableDropdownOpen(false)}
          >
            <Pressable style={styles.tableModalBackdrop} onPress={() => setTableDropdownOpen(false)}>
              <View style={styles.tableModalContent}>
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
            </Pressable>
          </Modal>
        </Animated.View>
      )}

      <Animated.View entering={FadeIn.duration(200)} style={[styles.tableRow, { marginHorizontal: horizontalPadding }]}>
        <Text style={styles.tableRowEmoji} allowFontScaling={false}>👤</Text>
        <TouchableOpacity
          style={styles.tableDropdown}
          onPress={() => setCustomerDropdownOpen(true)}
          activeOpacity={0.7}
        >
          <Text style={customerName ? styles.tableDropdownText : styles.tableDropdownPlaceholder} numberOfLines={1}>
            {customersLoading ? 'Loading...' : customerName || 'Select customer'}
          </Text>
          <Icon name="chevron-down" size={20} color={themeColors.textMuted} />
        </TouchableOpacity>
        <Modal
          visible={customerDropdownOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setCustomerDropdownOpen(false)}
        >
          <Pressable style={styles.tableModalBackdrop} onPress={() => setCustomerDropdownOpen(false)}>
            <View style={styles.tableModalContent}>
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
          </Pressable>
        </Modal>
      </Animated.View>

      {filteredItems.length === 0 ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.foodList}>
          <EmptyState
            icon={<Text style={styles.emptyEmoji} allowFontScaling={false}>🛒</Text>}
            title="No items"
            subtitle="Try another category or search"
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
          initialNumToRender={FOOD_LIST_INITIAL_NUM}
          windowSize={FOOD_LIST_WINDOW_SIZE}
          contentContainerStyle={[styles.mainContent, { paddingHorizontal: horizontalPadding }]}
          columnWrapperStyle={numColumns > 1 ? styles.foodGridRow : undefined}
          style={styles.main}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}

      <PressableScale
        activeScale={0.92}
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowCartSheet(true)}
      >
        <Text style={styles.fabEmoji} allowFontScaling={false}>🛒</Text>
        {cart.length > 0 && (
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>
              {cart.reduce((s, c) => s + c.qty, 0)}
            </Text>
          </View>
        )}
      </PressableScale>

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
              <View style={styles.cartSheetTitleRow}>
                <Text style={styles.cartTitle}>Cart</Text>
                {cart.length > 0 && (
                  <Badge count={cart.reduce((s, c) => s + c.qty, 0)} style={styles.cartBadgeMargin} />
                )}
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
                title="Cart is empty"
                subtitle="Add items from the menu"
              />
            ) : (
              <ScrollView
                style={styles.cartSheetScroll}
                contentContainerStyle={styles.cartSheetScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {cart.map((item, index) => renderCartItem(item, index))}
                <View style={styles.notesWrap}>
                  <Icon name="message-circle" size={18} color={themeColors.textSubtle} />
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Order notes (optional)"
                    placeholderTextColor={themeColors.textSubtle}
                    value={orderNotes}
                    onChangeText={(t) => setOrderNotes(t)}
                    multiline
                  />
                </View>
                <View style={styles.totals}>
                  <Row label="Subtotal" value={subtotal} />
                  <Row label="Service charge" value={APP_SERVICE_CHARGE_VALUE} />
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.submitBtn, shadowMd]}
                  onPress={() => {
                    handlePlaceOrder();
                    closeCartSheet();
                  }}
                  activeOpacity={0.85}
                >
                  <Icon name="shopping-bag" size={20} color="#fff" />
                  <Text style={styles.submitBtnText}>Place order</Text>
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
              {cart.map((c, i) => (
                <View key={`${c.food.id}-${i}`} style={styles.placeOrderItemRow}>
                  <Text style={styles.placeOrderItemName}>
                    {c.qty}× {c.food.item_name}
                    {(c.modifiers ?? []).length > 0 && ` (${(c.modifiers ?? []).map((m) => m.name).join(', ')})`}
                  </Text>
                  <Text style={styles.placeOrderItemTotal}>
                    ${lineTotal(c).toFixed(2)}
                  </Text>
                </View>
              ))}
              <View style={styles.placeOrderTotals}>
                <Row label="Subtotal" value={subtotal} />
                <Row label="Service charge" value={APP_SERVICE_CHARGE_VALUE} />
                <View style={styles.placeOrderTotalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
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
                  {modifiersCartIndex !== null && cart[modifiersCartIndex] ? cart[modifiersCartIndex].food.item_name : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModifiersCartIndex(null)} hitSlop={12} style={styles.modifiersModalClose}>
                <Icon name="x" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modifiersModalScroll} showsVerticalScrollIndicator={false}>
              {modifiersCartIndex !== null && cart[modifiersCartIndex] && (() => {
                const cartItem = cart[modifiersCartIndex];
                const currentMods = cartItem.modifiers ?? [];
                const addMod = (m: Modifier) => {
                  setCartItemModifiers({ index: modifiersCartIndex, modifiers: [...currentMods, m] });
                };
                const removeMod = (m: Modifier) => {
                  setCartItemModifiers({ index: modifiersCartIndex, modifiers: currentMods.filter((x) => x.id !== m.id) });
                };
                const available = DEMO_MODIFIERS.filter((m) => !currentMods.some((x) => x.id === m.id));
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
                            <Text style={styles.modifiersRowPrice}>{m.price > 0 ? `+$${m.price.toFixed(2)}` : 'Free'}</Text>
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
                          <Text style={styles.modifiersRowPrice}>{m.price > 0 ? `+$${m.price.toFixed(2)}` : 'Free'}</Text>
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

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>${value.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.surfaceTertiary,
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
    backgroundColor: themeColors.primaryDark,
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
  categoryBar: {
    backgroundColor: themeColors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  categoryScrollContent: {
    paddingRight: spacing.md,
  },
  categoryPillWrap: {
    marginRight: spacing.sm,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: themeColors.surfaceTertiary,
    borderWidth: 1.5,
    borderColor: themeColors.border,
    minHeight: 48,
  },
  categoryPillActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  categoryPillEmoji: {
    fontSize: 22,
    textAlign: 'center',
  },
  categoryPillLabel: {
    ...typography.bodySemibold,
    color: themeColors.textSecondary,
    maxWidth: 100,
  },
  categoryPillLabelActive: {
    color: themeColors.primaryContrast,
  },
  orderTypeRow: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: themeColors.surface,
  },
  orderTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: themeColors.surfaceSecondary,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  orderTypeBtnActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  orderTypeLabel: {
    ...typography.caption,
    color: themeColors.textMuted,
  },
  orderTypeLabelActive: {
    color: themeColors.primaryContrast,
  },
  orderTypeEmoji: {
    fontSize: 20,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: themeColors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: themeColors.border,
    gap: spacing.sm,
  },
  tableRowEmoji: {
    fontSize: 20,
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
    ...typography.bodyMedium,
    color: themeColors.text,
  },
  tableDropdownPlaceholder: {
    ...typography.bodyMedium,
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: themeColors.surfaceSecondary,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  search: {
    flex: 1,
    ...typography.body,
    color: themeColors.text,
    paddingVertical: spacing.xxs,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadowMd,
  },
  fabEmoji: {
    fontSize: 26,
    textAlign: 'center',
  },
  fabBadge: {
    position: 'absolute',
    top: -spacing.xxs,
    right: -spacing.xxs,
    minWidth: 20,
    height: 20,
    borderRadius: radius.sm,
    backgroundColor: themeColors.surface,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxs,
  },
  fabBadgeText: {
    ...typography.chip,
    fontSize: 11,
    color: ACCENT,
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
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
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  cartSheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cartBadgeMargin: {
    marginLeft: 0,
  },
  cartSheetCloseBtn: {
    marginLeft: 'auto',
    padding: spacing.xxs,
  },
  cartSheetScroll: {
    flex: 1,
  },
  cartSheetScrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  foodList: {
    paddingHorizontal: spacing.md,
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  foodGridRow: {
    paddingHorizontal: 0,
  },
  foodCardWrapper: {
    padding: spacing.xs,
    minHeight: 148,
  },
  foodCardOuter: {
    flex: 1,
  },
  foodCard: {
    flex: 1,
    backgroundColor: themeColors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 140,
    borderWidth: 1,
    borderColor: themeColors.borderLight,
    ...shadowSm,
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
    ...shadowSm,
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
    ...typography.h2,
    color: themeColors.text,
  },
  cartEmptyEmoji: {
    fontSize: 44,
    textAlign: 'center',
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.borderLight,
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
    width: 36,
    height: 36,
    borderRadius: radius.xs,
    backgroundColor: themeColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderBottomWidth: 1,
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
    backgroundColor: themeColors.primaryMuted,
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
    backgroundColor: themeColors.primaryMuted,
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
    marginTop: spacing.xs,
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
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: ACCENT,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
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
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  modifiersModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modifiersModalTitle: {
    ...typography.h2,
    color: themeColors.text,
  },
  modifiersModalSubtitle: {
    ...typography.body,
    color: themeColors.textMuted,
    marginTop: 2,
  },
  modifiersModalClose: {
    padding: spacing.xxs,
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
  modifiersDoneBtn: {
    backgroundColor: ACCENT,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifiersDoneBtnText: {
    ...typography.bodySemibold,
    color: themeColors.primaryContrast,
  },
});
