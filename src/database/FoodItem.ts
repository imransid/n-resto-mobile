import { Model, Relation } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type FoodCategory from './FoodCategory';

export default class FoodItem extends Model {
  static table = 'food_items' as const;

  @field('item_name')
  item_name!: string;

  @field('description')
  description!: string;

  @field('price')
  price!: number;

  @field('status')
  status!: boolean;

  @field('category_id')
  category_id!: string;

  @relation('food_categories', 'category_id')
  category!: Relation<FoodCategory>;
}
