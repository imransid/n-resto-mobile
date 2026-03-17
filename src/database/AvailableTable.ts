import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class AvailableTable extends Model {
  static table = 'available_tables' as const;

  @field('number')
  number!: string;

  @field('name')
  name!: string | null;

  @field('is_available')
  is_available!: boolean;
}
