import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export default class User extends Model {
  static table = 'users' as const;

  @field('user_id')
  user_id!: string | null;

  @field('email')
  email!: string;

  @field('name')
  name!: string;
}
