import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/**
 * Key-value record for persisting app state (auth, pos session) as JSON strings.
 */
export default class KeyValue extends Model {
  static table = 'key_value' as const;

  @field('key')
  key!: string;

  @text('value')
  value!: string;
}
