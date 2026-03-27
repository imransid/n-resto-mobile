/**
 * Offline-first: seed master data when local DB is empty.
 * Default: published kebab catalog (BDT). Replace via API sync when backend is ready.
 */
import { database } from './databaseInstance';
import FoodCategory from './FoodCategory';
import FoodItem from './FoodItem';
import AvailableTable from './AvailableTable';
import KeyValue from './KeyValue';
import { DEFAULT_PUBLISHED_POS_CATALOG } from '../constants/defaultPublishedCatalog';
import type { FoodItemPosMeta } from '../types/posCatalog';

const FALLBACK_TABLE_NUMBERS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
];

function assignRecordId(record: { _raw: { id: string } }, id: string): void {
  record._raw.id = id;
}

/** Returns true if master data was seeded (or already present). */
export async function seedMasterDataIfEmpty(): Promise<boolean> {
  const categoriesCollection = database.get<FoodCategory>('food_categories');
  const existing = await categoriesCollection.query().fetchCount();
  if (existing > 0) return true;

  const catalog = DEFAULT_PUBLISHED_POS_CATALOG;

  await database.write(async () => {
    const itemsCollection = database.get<FoodItem>('food_items');

    for (const cat of catalog.categories) {
      if (!cat.isActive) continue;

      await categoriesCollection.create((c) => {
        assignRecordId(c, cat.id);
        c.name = cat.name;
        c.sort_order = cat.displayOrder;
        c.group_id = null;
      });

      for (const menuItem of cat.items) {
        if (!menuItem.isActive) continue;
        const dineIn =
          menuItem.prices.find((p) => p.channel === 'DINE_IN')?.amount ??
          menuItem.prices[0]?.amount ??
          0;
        const meta: FoodItemPosMeta = {
          pricesByChannel: menuItem.prices.map((p) => ({
            channel: p.channel,
            amount: p.amount,
            currency: p.currency,
          })),
          variantGroups: menuItem.variantGroups,
          modifierGroups: menuItem.modifierGroups,
        };

        await itemsCollection.create((item) => {
          assignRecordId(item, menuItem.id);
          item.item_name = menuItem.name;
          item.description = menuItem.description;
          item.price = dineIn;
          item.status = true;
          item.category_id = cat.id;
          item.item_image_local = null;
          item.pos_meta = JSON.stringify(meta);
        });
      }
    }

    const tablesCollection = database.get<AvailableTable>('available_tables');
    for (const num of FALLBACK_TABLE_NUMBERS) {
      await tablesCollection.create((t) => {
        t.number = num;
        t.name = null;
        t.is_available = true;
      });
    }

    const kv = database.get<KeyValue>('key_value');
    await kv.create((r) => {
      r.key = 'pos_published_catalog';
      r.value = JSON.stringify({
        posId: catalog.posId,
        version: catalog.version,
        publishedAt: catalog.publishedAt,
        currency: catalog.currency,
      });
    });
  });

  return true;
}

/** Check if master data has been seeded (categories or items exist). */
export async function hasMasterData(): Promise<boolean> {
  const count = await database
    .get<FoodCategory>('food_categories')
    .query()
    .fetchCount();
  return count > 0;
}
