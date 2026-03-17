import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class FoodModifier extends Model {
  static table = 'food_modifiers' as const;

  @field('name')
  name!: string;

  @field('price')
  price!: number;

  /** When set, this modifier applies only to that food item; null = global modifier */
  @field('food_id')
  food_id!: string | null;
}
