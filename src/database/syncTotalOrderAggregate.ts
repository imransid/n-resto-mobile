import { database } from './databaseInstance';
import type Order from './Order';
import type TotalOrder from './TotalOrder';

/**
 * Recomputes aggregate counts from local `orders` rows and upserts a single
 * `total_orders` record (excludes CANCELLED, matches Orders UI).
 */
export async function syncTotalOrderAggregateFromOrders(orderRecords: Order[]): Promise<void> {
  const active = orderRecords.filter((o) => (o.status ?? '') !== 'CANCELLED');
  const order_count = active.length;
  const paid_count = active.filter((o) => (o.status ?? '') === 'PAID').length;
  const unpaid_count = order_count - paid_count;

  const collection = database.get<TotalOrder>('total_orders');

  await database.write(async () => {
    const existing = await collection.query().fetch();
    if (existing.length === 0) {
      await collection.create((r) => {
        r.order_count = order_count;
        r.paid_count = paid_count;
        r.unpaid_count = unpaid_count;
      });
      return;
    }
    const row = existing[0];
    await row.update((r) => {
      r.order_count = order_count;
      r.paid_count = paid_count;
      r.unpaid_count = unpaid_count;
    });
  });
}
