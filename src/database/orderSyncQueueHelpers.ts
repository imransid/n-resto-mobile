import { Q } from '@nozbe/watermelondb';

import { database } from './databaseInstance';
import type OrderSyncQueue from './OrderSyncQueue';

/** Enqueue once per order id (idempotent). */
export async function enqueueOrderForSync(orderId: string): Promise<void> {
  const coll = database.get<OrderSyncQueue>('order_sync_queue');
  const n = await coll.query(Q.where('order_id', orderId)).fetchCount();
  if (n > 0) return;
  await database.write(async () => {
    await coll.create((r) => {
      r.order_id = orderId;
    });
  });
}
