import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database/databaseInstance';
import { getPersistedSlice, setPersistedSlice } from '../database';
import type KeyValue from '../database/KeyValue';
import type Order from '../database/Order';
import type OrderSyncQueue from '../database/OrderSyncQueue';
import { enqueueOrderForSync } from '../database/orderSyncQueueHelpers';
import { syncTotalOrderAggregateFromOrders } from '../database/syncTotalOrderAggregate';
import {
  type CartItem,
  type CompletedOrder,
  type CompletedOrderItem,
  type Modifier,
  type OrderStatus,
  type PaymentMethod,
  type PosSessionState,
  type OrderType,
  INITIAL_POS_SESSION,
} from '../types/pos';
import type { FoodItem } from '../constants/demoData';
import { storeConfig } from '../constants/storeConfig';
import {
  requestOrderUploadNow,
  scheduleOrderSync,
} from '../services/orderBackgroundSyncService';
import { maybeNotifyRelayForNewOrder } from '../services/staffOrderNotifyRelay';

function orderToCompleted(order: Order): CompletedOrder {
  return {
    id: order.id,
    createdAt: new Date(order.created_at).toISOString(),
    items: order.itemsParsed,
    total: order.total,
    paymentMethod: order.payment_method as PaymentMethod,
    orderType: order.order_type as OrderType,
    tableNumber: order.table_number ?? '',
    customerName: order.customer_name ?? '',
    userId: order.created_by ?? '',
    companyId: order.company_id ?? '',
    orderNotes: order.order_notes ?? undefined,
    status: (order.status as OrderStatus) ?? 'PENDING',
  };
}

function normalizeCartItem(entry: unknown): CartItem | null {
  if (!entry || typeof entry !== 'object') return null;
  const o = entry as Record<string, unknown>;
  const foodRaw = o.food;
  if (!foodRaw || typeof foodRaw !== 'object') return null;
  const f = foodRaw as Record<string, unknown>;
  const id = typeof f.id === 'string' ? f.id : String(f.id ?? '');
  const item_name = typeof f.item_name === 'string' ? f.item_name : String(f.item_name ?? '');
  const rawPrice = f.price;
  const price =
    typeof rawPrice === 'number' && Number.isFinite(rawPrice)
      ? rawPrice
      : Number(String(rawPrice ?? '').replace(/,/g, '')) || 0;
  if (!id && !item_name) return null;
  const qty = typeof o.qty === 'number' && o.qty > 0 ? o.qty : 1;
  const modsRaw = Array.isArray(o.modifiers) ? o.modifiers : [];
  const modifiers: Modifier[] = modsRaw
    .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
    .map((m) => ({
      id: typeof m.id === 'string' ? m.id : String(m.id ?? ''),
      name: typeof m.name === 'string' ? m.name : String(m.name ?? ''),
      price:
        typeof m.price === 'number' && Number.isFinite(m.price)
          ? m.price
          : Number(String(m.price ?? '').replace(/,/g, '')) || 0,
    }));
  const food: FoodItem = {
    id,
    item_name,
    description: typeof f.description === 'string' ? f.description : '',
    price,
    status: typeof f.status === 'boolean' ? f.status : true,
    category: typeof f.category === 'string' ? f.category : '',
  };
  return { food, qty, modifiers: modifiers.length ? modifiers : undefined };
}

function parsePosSession(raw: Record<string, unknown> | null): PosSessionState {
  if (!raw || typeof raw !== 'object') return INITIAL_POS_SESSION;
  const cart: CartItem[] = Array.isArray(raw.cart)
    ? raw.cart.map(normalizeCartItem).filter((x): x is CartItem => x != null)
    : INITIAL_POS_SESSION.cart;
  return {
    cart,
    orderType: (raw.orderType as OrderType) ?? INITIAL_POS_SESSION.orderType,
    tableNumber: typeof raw.tableNumber === 'string' ? raw.tableNumber : INITIAL_POS_SESSION.tableNumber,
    customerName: typeof raw.customerName === 'string' ? raw.customerName : INITIAL_POS_SESSION.customerName,
    discountPercent: typeof raw.discountPercent === 'number' ? raw.discountPercent : INITIAL_POS_SESSION.discountPercent,
    chargePercent: typeof raw.chargePercent === 'number' ? raw.chargePercent : INITIAL_POS_SESSION.chargePercent,
    taxPercent: typeof raw.taxPercent === 'number' ? raw.taxPercent : INITIAL_POS_SESSION.taxPercent,
    orderNotes: typeof raw.orderNotes === 'string' ? raw.orderNotes : INITIAL_POS_SESSION.orderNotes,
    paymentMethod: (raw.paymentMethod as PaymentMethod) ?? INITIAL_POS_SESSION.paymentMethod,
  };
}

interface AppContextValue {
  posSession: PosSessionState;
  orders: CompletedOrder[];
  addToCart: (payload: { food: FoodItem; qty?: number; modifiers?: Modifier[] }) => Promise<void>;
  updateCartItemQty: (payload: { index: number; qty: number }) => Promise<void>;
  setCartItemModifiers: (payload: { index: number; modifiers: Modifier[] }) => Promise<void>;
  removeFromCartByIndex: (index: number) => Promise<void>;
  clearCart: () => Promise<void>;
  setOrderType: (orderType: OrderType) => Promise<void>;
  setTableNumber: (tableNumber: string) => void;
  setCustomerName: (customerName: string) => void;
  setDiscountPercent: (value: number) => Promise<void>;
  setChargePercent: (value: number) => Promise<void>;
  setTaxPercent: (value: number) => Promise<void>;
  setOrderNotes: (notes: string) => Promise<void>;
  setPaymentMethod: (method: PaymentMethod) => Promise<void>;
  addCompletedOrder: (order: Omit<CompletedOrder, 'status'> & { id?: string; createdAt?: string }) => Promise<void>;
  updateOrderInHistory: (payload: { orderId: string; status?: OrderStatus; paymentMethod?: PaymentMethod }) => Promise<void>;
  addItemsToOrder: (payload: { orderId: string; newItems: CompletedOrderItem[] }) => Promise<void>;
  clearOrderHistory: () => Promise<void>;
  refreshOrders: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const AGGREGATE_DEBOUNCE_MS = 320;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [posSession, setPosSession] = useState<PosSessionState>(INITIAL_POS_SESSION);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const aggregateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const posRaw = await getPersistedSlice('pos');
        if (!cancelled) {
          const parsed = parsePosSession(posRaw);
          setPosSession(parsed);
          if (posRaw == null) {
            await setPersistedSlice('pos', parsed as unknown as Record<string, unknown>);
          }
        }
      } catch {
        // ignore
      }
    })();

    try {
      const kv = database.get<KeyValue>('key_value');
      const subPos = kv.query(Q.where('key', 'pos')).observe().subscribe((records) => {
        const r = records[0];
        const raw = r?.value != null ? (JSON.parse(r.value) as Record<string, unknown>) : null;
        setPosSession(parsePosSession(raw));
      });
      const ordersCollection = database.get<Order>('orders');
      const subOrders = ordersCollection
        .query()
        .observe()
        .subscribe((orderRecords) => {
          const sorted = [...orderRecords].sort((a, b) => b.created_at - a.created_at);
          setOrders(sorted.map(orderToCompleted));
          if (aggregateTimerRef.current != null) clearTimeout(aggregateTimerRef.current);
          aggregateTimerRef.current = setTimeout(() => {
            aggregateTimerRef.current = null;
            syncTotalOrderAggregateFromOrders(sorted).catch((err) => {
              if (__DEV__) console.warn('syncTotalOrderAggregateFromOrders', err);
            });
          }, AGGREGATE_DEBOUNCE_MS);
        });
      return () => {
        cancelled = true;
        if (aggregateTimerRef.current != null) {
          clearTimeout(aggregateTimerRef.current);
          aggregateTimerRef.current = null;
        }
        subPos.unsubscribe();
        subOrders.unsubscribe();
      };
    } catch (err) {
      if (__DEV__) console.warn('AppContext: database not ready', err);
      return () => {
        cancelled = true;
      };
    }
  }, []);

  const persistPos = useCallback(async (next: PosSessionState) => {
    await setPersistedSlice('pos', next as unknown as Record<string, unknown>);
  }, []);

  const refreshPosFromDb = useCallback(() => {
    getPersistedSlice('pos').then((raw) => {
      if (raw != null) setPosSession(parsePosSession(raw));
    });
  }, []);

  const addToCart = useCallback(
    async (payload: { food: FoodItem; qty?: number; modifiers?: Modifier[] }) => {
      const { food, qty = 1, modifiers = [] } = payload;
      setPosSession((prev) => {
        const key = [...(modifiers ?? [])].map((m) => m.id).sort().join(',');
        const existingIdx = prev.cart.findIndex(
          (c) => c.food.id === food.id && [...(c.modifiers ?? [])].map((m) => m.id).sort().join(',') === key
        );
        let nextCart: CartItem[];
        if (existingIdx >= 0) {
          nextCart = prev.cart.slice();
          nextCart[existingIdx] = { ...nextCart[existingIdx], qty: nextCart[existingIdx].qty + qty };
        } else {
          nextCart = [...prev.cart, { food, qty, modifiers }];
        }
        const next = { ...prev, cart: nextCart };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );

  const updateCartItemQty = useCallback(
    async (payload: { index: number; qty: number }) => {
      const { index, qty } = payload;
      setPosSession((prev) => {
        if (index < 0 || index >= prev.cart.length) return prev;
        let nextCart: CartItem[];
        if (qty <= 0) {
          nextCart = prev.cart.filter((_, i) => i !== index);
        } else {
          nextCart = prev.cart.slice();
          nextCart[index] = { ...nextCart[index], qty };
        }
        const next = { ...prev, cart: nextCart };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );

  const setCartItemModifiers = useCallback(
    async (payload: { index: number; modifiers: Modifier[] }) => {
      const { index, modifiers } = payload;
      setPosSession((prev) => {
        if (index < 0 || index >= prev.cart.length) return prev;
        const nextCart = prev.cart.slice();
        nextCart[index] = { ...nextCart[index], modifiers };
        const next = { ...prev, cart: nextCart };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );

  const removeFromCartByIndex = useCallback(
    async (index: number) => {
      setPosSession((prev) => {
        if (index < 0 || index >= prev.cart.length) return prev;
        const nextCart = prev.cart.filter((_, i) => i !== index);
        const next = { ...prev, cart: nextCart };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );

  const clearCart = useCallback(async () => {
    setPosSession((prev) => {
      const next = { ...prev, cart: [] };
      persistPos(next).then(refreshPosFromDb);
      return next;
    });
  }, [persistPos, refreshPosFromDb]);

  const setOrderType = useCallback(
    async (orderType: OrderType) => {
      setPosSession((prev) => {
        if (prev.orderType === orderType) return prev;
        const next = { ...prev, orderType };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );
  const setTableNumber = useCallback(
    (tableNumber: string) => {
      setPosSession((prev) => {
        if (prev.tableNumber === tableNumber) return prev;
        const next = { ...prev, tableNumber };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );
  const setCustomerName = useCallback(
    (customerName: string) => {
      setPosSession((prev) => {
        if (prev.customerName === customerName) return prev;
        const next = { ...prev, customerName };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb]
  );
  const setDiscountPercent = useCallback(
    async (value: number) => await persistPos({ ...posSession, discountPercent: Math.max(0, Math.min(100, value)) }),
    [posSession, persistPos]
  );
  const setChargePercent = useCallback(
    async (value: number) => await persistPos({ ...posSession, chargePercent: Math.max(0, Math.min(100, value)) }),
    [posSession, persistPos]
  );
  const setTaxPercent = useCallback(
    async (value: number) => await persistPos({ ...posSession, taxPercent: Math.max(0, Math.min(100, value)) }),
    [posSession, persistPos]
  );
  const setOrderNotes = useCallback(
    async (orderNotes: string) => await persistPos({ ...posSession, orderNotes }),
    [posSession, persistPos]
  );
  const setPaymentMethod = useCallback(
    async (paymentMethod: PaymentMethod) => await persistPos({ ...posSession, paymentMethod }),
    [posSession, persistPos]
  );

  const refreshOrders = useCallback(async () => {
    const ordersCollection = database.get<Order>('orders');
    const orderRecords = await ordersCollection.query().fetch();
    const sorted = [...orderRecords].sort((a, b) => b.created_at - a.created_at);
    setOrders(sorted.map(orderToCompleted));
  }, []);

  const addCompletedOrder = useCallback(
    async (order: Omit<CompletedOrder, 'status'> & { id?: string; createdAt?: string }) => {
      const createdAtMs = order.createdAt
        ? new Date(order.createdAt).getTime()
        : Date.now();
      const ordersCollection = database.get<Order>('orders');
      const queueCollection = database.get<OrderSyncQueue>('order_sync_queue');
      let createdLocalId = '';
      await database.write(async () => {
        const newOrder = await ordersCollection.create((r) => {
          r.created_at = createdAtMs;
          r.total = order.total;
          r.payment_method = order.paymentMethod;
          r.order_type = order.orderType;
          r.table_number = order.tableNumber;
          r.customer_name = order.customerName;
          r.order_notes = order.orderNotes ?? null;
          r.status = 'PENDING';
          r.created_by = order.userId;
          r.company_id = order.companyId || (storeConfig.masterDataCompanyId ?? '').trim() || null;
          r.items = JSON.stringify(order.items);
        });
        createdLocalId = newOrder.id;
        await queueCollection.create((q) => {
          q.order_id = newOrder.id;
        });
      });
      maybeNotifyRelayForNewOrder({
        localOrderId: createdLocalId,
        total: order.total,
        companyId: (order.companyId || (storeConfig.masterDataCompanyId ?? '').trim() || '').trim(),
        createdBy: order.userId,
      }).catch(() => undefined);
      await refreshOrders();
      /** Outbox changed — sync does not run on “still online”; only connectivity flips / cold-start / foreground without this. */
      scheduleOrderSync('order_completed');
      requestOrderUploadNow('order_completed');
      setPosSession((prev) => {
        const next = {
          ...prev,
          cart: [],
          orderNotes: '',
          tableNumber: '',
          customerName: '',
        };
        persistPos(next).then(refreshPosFromDb);
        return next;
      });
    },
    [persistPos, refreshPosFromDb, refreshOrders]
  );

  const updateOrderInHistory = useCallback(
    async (payload: { orderId: string; status?: OrderStatus; paymentMethod?: PaymentMethod }) => {
      const ordersCollection = database.get<Order>('orders');
      const rows = await ordersCollection.query(Q.where('id', payload.orderId)).fetch();
      const order = rows[0];
      if (!order) return;
      await database.write(async () => {
        await order.update((r) => {
          if (payload.status != null) {
            r.status = payload.status;
            if (payload.status === 'PAID') r.paid_at = Date.now();
          }
          if (payload.paymentMethod != null) r.payment_method = payload.paymentMethod;
        });
      });
      await enqueueOrderForSync(payload.orderId);
      await refreshOrders();
      scheduleOrderSync('order_updated');
      requestOrderUploadNow('order_updated');
    },
    [refreshOrders]
  );

  const addItemsToOrder = useCallback(
    async (payload: { orderId: string; newItems: CompletedOrderItem[] }) => {
      const ordersCollection = database.get<Order>('orders');
      const rows = await ordersCollection.query(Q.where('id', payload.orderId)).fetch();
      const order = rows[0];
      if (!order || !payload.newItems.length) return;
      const extraTotal = payload.newItems.reduce((s, i) => s + i.price * i.qty, 0);
      const newItems = [...order.itemsParsed, ...payload.newItems];
      const newTotal = Math.round((order.total + extraTotal) * 100) / 100;
      await database.write(async () => {
        await order.update((r) => {
          r.items = JSON.stringify(newItems);
          r.total = newTotal;
        });
      });
      await enqueueOrderForSync(payload.orderId);
      await refreshOrders();
      scheduleOrderSync('order_items_changed');
      requestOrderUploadNow('order_items_changed');
    },
    [refreshOrders]
  );

  const clearOrderHistory = useCallback(async () => {
    const ordersCollection = database.get<Order>('orders');
    const queueCollection = database.get<OrderSyncQueue>('order_sync_queue');
    const all = await ordersCollection.query().fetch();
    const qrows = await queueCollection.query().fetch();
    await database.write(async () => {
      for (const q of qrows) await q.destroyPermanently();
      for (const o of all) await o.destroyPermanently();
    });
    await refreshOrders();
  }, [refreshOrders]);

  const value = useMemo<AppContextValue>(
    () => ({
    posSession,
    orders,
    addToCart,
    updateCartItemQty,
    setCartItemModifiers,
    removeFromCartByIndex,
    clearCart,
    setOrderType,
    setTableNumber,
    setCustomerName,
    setDiscountPercent,
    setChargePercent,
    setTaxPercent,
    setOrderNotes,
    setPaymentMethod,
    addCompletedOrder,
    updateOrderInHistory,
    addItemsToOrder,
    clearOrderHistory,
    refreshOrders,
    }),
    [
      posSession,
      orders,
      addToCart,
      updateCartItemQty,
      setCartItemModifiers,
      removeFromCartByIndex,
      clearCart,
      setOrderType,
      setTableNumber,
      setCustomerName,
      setDiscountPercent,
      setChargePercent,
      setTaxPercent,
      setOrderNotes,
      setPaymentMethod,
      addCompletedOrder,
      updateOrderInHistory,
      addItemsToOrder,
      clearOrderHistory,
      refreshOrders,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
