import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class FoodCategory extends Model {
  static table = 'food_categories' as const;

  @field('name')
  name!: string;

  @field('sort_order')
  sort_order!: number | null;

  @field('group_id')
  group_id!: string | null;
}
