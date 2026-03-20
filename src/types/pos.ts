import type { FoodItem } from '../constants/demoData';

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  food: FoodItem;
  qty: number;
  modifiers?: Modifier[];
}

export function modifierIdsKey(mods: Modifier[] | undefined): string {
  if (!mods?.length) return '';
  return [...mods]
    .map(m => m.id)
    .sort()
    .join(',');
}

const ORDER_ID_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateOrderId(): string {
  let suffix = '';
  for (let i = 0; i < 8; i++) {
    suffix += ORDER_ID_CHARS.charAt(
      Math.floor(Math.random() * ORDER_ID_CHARS.length),
    );
  }
  return `ORD${suffix}BOLT`;
}

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'DELIVERED'
  | 'PAID'
  | 'CANCELLED';

export interface CompletedOrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface CompletedOrder {
  id: string;
  createdAt: string;
  items: CompletedOrderItem[];
  total: number;
  paymentMethod: PaymentMethod;
  orderType: OrderType;
  tableNumber: string;
  customerName: string;
  userId: string;
  companyId: string;
  orderNotes?: string;
  status?: OrderStatus;
}

export interface PosSessionState {
  cart: CartItem[];
  orderType: OrderType;
  tableNumber: string;
  customerName: string;
  discountPercent: number;
  chargePercent: number;
  taxPercent: number;
  orderNotes: string;
  paymentMethod: PaymentMethod;
}

const APP_SERVICE_CHARGE = 2;

export const APP_SERVICE_CHARGE_VALUE = APP_SERVICE_CHARGE;

export function getSubtotal(cart: CartItem[]): number {
  return cart.reduce((s, x) => {
    const base = x.food.price * x.qty;
    const modTotal = (x.modifiers ?? []).reduce(
      (m, mod) => m + mod.price * x.qty,
      0,
    );
    return s + base + modTotal;
  }, 0);
}

export function getTotal(
  cart: CartItem[],
  discountPercent: number,
  chargePercent: number,
  taxPercent: number,
): number {
  const subtotal = getSubtotal(cart);
  const discountAmt = subtotal * (discountPercent / 100);
  const afterDiscount = subtotal - discountAmt;
  const chargeAmt = afterDiscount * (chargePercent / 100);
  const taxAmt = afterDiscount * (taxPercent / 100);
  return (
    Math.round(
      (afterDiscount + chargeAmt + taxAmt + APP_SERVICE_CHARGE) * 100,
    ) / 100
  );
}

export const INITIAL_POS_SESSION: PosSessionState = {
  cart: [],
  orderType: 'DINE_IN',
  tableNumber: '',
  customerName: '',
  discountPercent: 0,
  chargePercent: 0,
  taxPercent: 0,
  orderNotes: '',
  paymentMethod: 'CASH',
};
