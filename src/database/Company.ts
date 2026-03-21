import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

/** Logged-in tenant / restaurant (from auth login `data.company`). */
export default class Company extends Model {
  static table = 'companies' as const;

  @field('company_id')
  company_id!: string;

  @field('name')
  name!: string;

  @field('address')
  address!: string | null;

  @field('phone')
  phone!: string | null;

  @field('email')
  email!: string | null;

  @field('website')
  website!: string | null;

  @field('logo')
  logo!: string | null;

  @field('profile_extra')
  profile_extra!: string | null;
}
