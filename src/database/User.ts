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

  @field('phone')
  phone!: string | null;

  @field('role')
  role!: string | null;

  @field('company_id')
  company_id!: string | null;

  @field('avatar_url')
  avatar_url!: string | null;

  @field('profile_extra')
  profile_extra!: string | null;
}
