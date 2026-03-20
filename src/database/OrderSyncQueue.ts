import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/** Pending upload — no flag on `orders`; presence here means “not yet successfully POSTed”. */
export default class OrderSyncQueue extends Model {
  static table = 'order_sync_queue' as const;

  @field('order_id')
  order_id!: string;
}
