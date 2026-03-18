/**
 * Offline-first: seed master data from demo data when local DB is empty.
 * Call after DB is ready (e.g. on app init or when syncing).
 */
import { database } from './databaseInstance';
import FoodCategory from './FoodCategory';
import FoodItem from './FoodItem';
import FoodModifier from './FoodModifier';
import AvailableTable from './AvailableTable';
import {
  DEMO_FOOD_ITEMS,
  CATEGORIES,
  DEMO_MODIFIERS,
} from '../constants/demoData';

const FALLBACK_TABLE_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

/** Returns true if master data was seeded (or already present). */
export async function seedMasterDataIfEmpty(): Promise<boolean> {
  const categoriesCollection = database.get<FoodCategory>('food_categories');
  const existing = await categoriesCollection.query().fetchCount();
  if (existing > 0) return true;

  await database.write(async () => {
    // 1. Categories (skip "All" which is UI-only)
    const categoryNameToId = new Map<string, string>();
    for (const c of CATEGORIES) {
      if (c.id === 'All') continue;
      const record = await categoriesCollection.create((cat) => {
        cat.name = c.label;
      });
      categoryNameToId.set(c.id, record.id);
    }

    // 2. Food items (link to category by name)
    const itemsCollection = database.get<FoodItem>('food_items');
    for (const f of DEMO_FOOD_ITEMS) {
      const categoryId = categoryNameToId.get(f.category);
      if (!categoryId) continue;
      await itemsCollection.create((item) => {
        item.item_name = f.item_name;
        item.description = f.description;
        item.price = f.price;
        item.status = f.status;
        item.category_id = categoryId;
        item.item_image_local = null;
      });
    }

    // 3. Modifiers (global: food_id = null)
    const modifiersCollection = database.get<FoodModifier>('food_modifiers');
    for (const m of DEMO_MODIFIERS) {
      await modifiersCollection.create((mod) => {
        mod.name = m.name;
        mod.price = m.price;
        mod.food_id = null;
      });
    }

    // 4. Tables
    const tablesCollection = database.get<AvailableTable>('available_tables');
    for (const num of FALLBACK_TABLE_NUMBERS) {
      await tablesCollection.create((t) => {
        t.number = num;
        t.name = null;
        t.is_available = true;
      });
    }
  });

  return true;
}

/** Check if master data has been seeded (categories or items exist). */
export async function hasMasterData(): Promise<boolean> {
  const count = await database.get<FoodCategory>('food_categories').query().fetchCount();
  return count > 0;
}
