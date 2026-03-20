import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/** Singleton-style aggregate row: total / paid / unpaid counts (non-cancelled). */
export default class TotalOrder extends Model {
  static table = 'total_orders' as const;

  @field('order_count')
  order_count!: number;

  @field('paid_count')
  paid_count!: number;

  @field('unpaid_count')
  unpaid_count!: number;
}
