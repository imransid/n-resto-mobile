/**
 * App-wide icons & emojis — modern, meaningful, consistent.
 * Use emojis for menu/food/order/payment to be instantly recognizable and impactful.
 */

/** Menu categories — same as food cards for consistency */
export const CATEGORY_EMOJI: Record<string, string> = {
  All: '📋',
  Burger: '🍔',
  Chinese: '🍜',
  Pastry: '🥐',
  'Soft Drink': '🥤',
  'Fruit Juices': '🍊',
  Fries: '🍟',
  Pizza: '🍕',
  Coffee: '☕',
  'Ice-Cream': '🍦',
  Sandwich: '🥪',
};

/** Food item card icon per category (same as category for consistency) */
export const FOOD_ITEM_EMOJI: Record<string, string> = {
  ...CATEGORY_EMOJI,
};
export function getFoodEmoji(category: string): string {
  return FOOD_ITEM_EMOJI[category] ?? '🍽️';
}

/** Order type — clear and impactful */
export const ORDER_TYPE_EMOJI: Record<string, string> = {
  DINE_IN: '🍽️',
  TAKEAWAY: '📦',
  DELIVERY: '🚚',
};

/** Payment method — recognizable at a glance */
export const PAYMENT_EMOJI: Record<string, string> = {
  MOBILE: '📱',
  CARD: '💳',
  CASH: '💵',
};

/** Feather icon names for UI actions (when emoji not used) */
export const FEATHER_ICONS = {
  search: 'search',
  close: 'x',
  check: 'check',
  plus: 'plus',
  minus: 'minus',
  cart: 'shopping-cart',
  bag: 'shopping-bag',
  table: 'grid',
  message: 'message-circle',
  trash: 'trash-2',
  arrowRight: 'arrow-right',
  filter: 'filter',
  chevronRight: 'chevron-right',
  chevronDown: 'chevron-down',
  chevronUp: 'chevron-up',
  clipboard: 'clipboard',
  clock: 'clock',
  checkCircle: 'check-circle',
  inbox: 'inbox',
  dollar: 'dollar-sign',
  logOut: 'log-out',
  mail: 'mail',
  lock: 'lock',
  printer: 'printer',
  plusCircle: 'plus-circle',
} as const;
