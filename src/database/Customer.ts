import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class Customer extends Model {
  static table = 'customers' as const;

  @field('name')
  name!: string;

  @field('phone')
  phone!: string | null;

  @field('email')
  email!: string | null;
}
