import { Q } from '@nozbe/watermelondb';

import { database } from './databaseInstance';
import KeyValue from './KeyValue';

export { database };

/**
 * Get app state slice by key (auth, pos, etc.) as parsed JSON, or null if missing/invalid.
 */
export async function getPersistedSlice(
  key: string
): Promise<Record<string, unknown> | null> {
  const collection = database.get<KeyValue>('key_value');
  const rows = await collection.query(Q.where('key', key)).fetch();
  const record = rows[0];
  if (!record?.value) return null;
  try {
    return JSON.parse(record.value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Persist app state slice by key (upsert). Value is stringified and stored.
 */
export async function setPersistedSlice(
  key: string,
  value: Record<string, unknown>
): Promise<void> {
  const collection = database.get<KeyValue>('key_value');
  const rows = await collection.query(Q.where('key', key)).fetch();
  const record = rows[0];
  const valueStr = JSON.stringify(value);
  await database.write(async () => {
    if (record) {
      await record.update((r) => {
        r.value = valueStr;
      });
    } else {
      await collection.create((r) => {
        r.key = key;
        r.value = valueStr;
      });
    }
  });
}

export { schema } from './schema';
export { migrations } from './migrations';
export { default as KeyValue } from './KeyValue';
export { default as User } from './User';
export { default as Order } from './Order';
export { default as FoodGroup } from './FoodGroup';
export { default as FoodCategory } from './FoodCategory';
export { default as FoodItem } from './FoodItem';
export { default as FoodModifier } from './FoodModifier';
export { default as AvailableTable } from './AvailableTable';
export { default as Customer } from './Customer';
export { default as TotalOrder } from './TotalOrder';
export { syncTotalOrderAggregateFromOrders } from './syncTotalOrderAggregate';
export { seedMasterDataIfEmpty, hasMasterData } from './seedMasterData';
