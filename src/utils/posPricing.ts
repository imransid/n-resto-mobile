import type { FoodItem } from '../constants/demoData';
import type { OrderType } from '../types/pos';

/**
 * Base menu price for the current order type (dine-in vs pickup vs delivery).
 */
export function amountForChannel(food: FoodItem, orderType: OrderType): number {
  const list = food.pricesByChannel;
  if (!list?.length) {
    const p = food.price;
    return typeof p === 'number' && Number.isFinite(p) ? p : 0;
  }
  const byCh = new Map(list.map((x) => [x.channel, x.amount]));
  if (orderType === 'DINE_IN') {
    return (
      byCh.get('DINE_IN') ??
      byCh.get('TAKEAWAY') ??
      food.price ??
      0
    );
  }
  if (orderType === 'TAKEAWAY') {
    return (
      byCh.get('TAKEAWAY') ??
      byCh.get('DINE_IN') ??
      food.price ??
      0
    );
  }
  return (
    byCh.get('DELIVERY') ??
    byCh.get('TAKEAWAY') ??
    byCh.get('DINE_IN') ??
    food.price ??
    0
  );
}
