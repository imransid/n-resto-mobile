import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class FoodGroup extends Model {
  static table = 'food_groups' as const;

  @field('name')
  name!: string;

  @field('sort_order')
  sort_order!: number | null;
}
