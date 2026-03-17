import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/** Order line item stored as JSON in items column */
export interface OrderItemRecord {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export default class Order extends Model {
  static table = 'orders' as const;

  @field('created_at')
  created_at!: number;

  @field('total')
  total!: number;

  @field('payment_method')
  payment_method!: string;

  @field('order_type')
  order_type!: string;

  @field('table_number')
  table_number!: string | null;

  @field('customer_name')
  customer_name!: string | null;

  @field('order_notes')
  order_notes!: string | null;

  @field('status')
  status!: string | null;

  @field('created_by')
  created_by!: string | null;

  @text('items')
  items!: string;

  /** Parsed items JSON */
  get itemsParsed(): OrderItemRecord[] {
    try {
      return JSON.parse(this.items) as OrderItemRecord[];
    } catch {
      return [];
    }
  }
}
