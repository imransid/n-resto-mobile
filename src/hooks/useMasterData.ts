/**
 * Load categories, food items, and modifiers from WatermelonDB for POS.
 * Falls back to demo data when DB is empty. Re-renders when DB changes.
 */
import { useEffect, useState } from 'react';
import { database } from '../database/databaseInstance';
import type FoodCategoryModel from '../database/FoodCategory';
import type FoodItemModel from '../database/FoodItem';
import type FoodModifierModel from '../database/FoodModifier';
import type { FoodItem } from '../constants/demoData';
import type { Modifier } from '../types/pos';
import { CATEGORIES, DEMO_FOOD_ITEMS, DEMO_MODIFIERS } from '../constants/demoData';

export interface MasterData {
  categories: { id: string; label: string }[];
  items: FoodItem[];
  modifiers: Modifier[];
}

async function loadFromDb(): Promise<MasterData> {
  const categoriesCollection = database.get<FoodCategoryModel>('food_categories');
  const itemsCollection = database.get<FoodItemModel>('food_items');
  const modifiersCollection = database.get<FoodModifierModel>('food_modifiers');

  const [categories, items, modifiers] = await Promise.all([
    categoriesCollection.query().fetch(),
    itemsCollection.query().fetch(),
    modifiersCollection.query().fetch(),
  ]);

  const categoryIdToName = new Map(categories.map((c) => [c.id, c.name]));

  const categoryList: { id: string; label: string }[] = [
    { id: 'All', label: 'All' },
    ...categories.map((c) => ({ id: c.id, label: c.name })),
  ];

  const itemList: FoodItem[] = items.map((item) => {
    const raw = item.price as unknown;
    const price =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw) || 0;
    return {
      id: item.id,
      item_name: item.item_name,
      description: item.description,
      price,
      status: item.status,
      category: categoryIdToName.get(item.category_id) ?? '',
      item_image_local: item.item_image_local ?? null,
    };
  });

  const modifierList: Modifier[] = modifiers.map((m) => {
    const raw = m.price as unknown;
    const price =
      typeof raw === 'number' && Number.isFinite(raw) ? raw : Number(raw) || 0;
    return { id: m.id, name: m.name, price };
  });

  return {
    categories: categoryList,
    items: itemList,
    modifiers: modifierList,
  };
}

/** Coalesce rapid Watermelon observer bursts (e.g. bulk sync) into one UI update. */
const MASTER_DATA_REFRESH_DEBOUNCE_MS = 100;

export function useMasterData(): MasterData {
  const [data, setData] = useState<MasterData>({
    categories: CATEGORIES,
    items: DEMO_FOOD_ITEMS,
    modifiers: DEMO_MODIFIERS,
  });

  useEffect(() => {
    let cancelled = false;
    const debounceRef = { t: null as ReturnType<typeof setTimeout> | null };

    const refresh = async () => {
      try {
        const next = await loadFromDb();
        if (cancelled) return;
        const useDb =
          next.items.length > 0 ||
          next.categories.length > 1 ||
          next.modifiers.length > 0;
        setData(
          useDb
            ? next
            : {
                categories: CATEGORIES,
                items: DEMO_FOOD_ITEMS,
                modifiers: DEMO_MODIFIERS,
              }
        );
      } catch {
        if (!cancelled)
          setData({
            categories: CATEGORIES,
            items: DEMO_FOOD_ITEMS,
            modifiers: DEMO_MODIFIERS,
          });
      }
    };

    const scheduleRefresh = () => {
      if (debounceRef.t != null) clearTimeout(debounceRef.t);
      debounceRef.t = setTimeout(() => {
        debounceRef.t = null;
        refresh().catch(() => {});
      }, MASTER_DATA_REFRESH_DEBOUNCE_MS);
    };

    refresh().catch(() => {});

    const unsubCategories = database
      .get<FoodCategoryModel>('food_categories')
      .query()
      .observe()
      .subscribe(scheduleRefresh);
    const unsubItems = database
      .get<FoodItemModel>('food_items')
      .query()
      .observe()
      .subscribe(scheduleRefresh);
    const unsubModifiers = database
      .get<FoodModifierModel>('food_modifiers')
      .query()
      .observe()
      .subscribe(scheduleRefresh);

    return () => {
      cancelled = true;
      if (debounceRef.t != null) clearTimeout(debounceRef.t);
      unsubCategories.unsubscribe();
      unsubItems.unsubscribe();
      unsubModifiers.unsubscribe();
    };
  }, []);

  return data;
}
