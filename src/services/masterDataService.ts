/**
 * Master data: one-shot GraphQL getMasterData + persist to WatermelonDB.
 * Used at app init to load ingredients, food groups, food items, food modifiers.
 */
import { Platform } from 'react-native';
import { database } from '../database/databaseInstance';
import { getPersistedSlice, setPersistedSlice } from '../database';
import type FoodCategory from '../database/FoodCategory';
import type FoodItem from '../database/FoodItem';
import type FoodModifier from '../database/FoodModifier';
import { storeConfig } from '../constants/storeConfig';
import { downloadMasterDataImagesInBackground } from './masterDataImageService';
import { isInternetReachable } from './networkService';

/** On Android emulator, localhost is the emulator itself; use 10.0.2.2 to reach the host machine. */
function resolveGraphqlUrl(base: string): string {
  if (Platform.OS === 'android' && (base.includes('localhost') || base.includes('127.0.0.1'))) {
    return base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  return base;
}

// --- GraphQL response types (match API) ---
export interface MasterDataIngredient {
  id: string;
  item_name: string;
  description?: string | null;
  price?: number | null;
  quantity?: number | null;
  unit?: string | null;
  alert_quantity?: number | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MasterDataFoodGroup {
  id: string;
  group_name: string;
  food_group_image?: string | null;
  status?: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MasterDataFoodItem {
  id: string;
  item_name: string;
  description?: string | null;
  price: number;
  /** Image URL or path from API (snake_case or camelCase) */
  item_image?: string | null;
  itemImage?: string | null;
  food_group_id: string;
  status?: boolean | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  foodGroup?: { id: string; group_name: string } | null;
}

export interface MasterDataFoodModifier {
  id: string;
  title: string;
  price: number;
  ingredient_item?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface MasterDataResult {
  ingredients: MasterDataIngredient[];
  foodGroups: MasterDataFoodGroup[];
  foodItems: MasterDataFoodItem[];
  foodModifiers: MasterDataFoodModifier[];
}

const GET_MASTER_DATA_QUERY = `
query GetMasterData($deviceId: String, $userId: String, $description: String) {
  getMasterData(deviceId: $deviceId, userId: $userId, description: $description) {
    ingredients { id item_name description price quantity unit alert_quantity created_by created_at updated_at }
    foodGroups { id group_name food_group_image status created_by created_at updated_at }
    foodItems { id item_name description price item_image itemImage food_group_id status created_by created_at updated_at foodGroup { id group_name } }
    foodModifiers { id title price ingredient_item created_by created_at updated_at }
  }
}
`;

/**
 * Fetch master data from GraphQL. Returns null if API base is empty or request fails.
 */
export async function fetchMasterData(params?: {
  deviceId?: string;
  userId?: string;
  description?: string;
}): Promise<MasterDataResult | null> {
  const base = (storeConfig.graphqlApiBase ?? '').trim();
  if (!base) return null;

  const variables: Record<string, string | undefined> = {
    deviceId: params?.deviceId,
    userId: params?.userId,
    description: params?.description ?? 'Master data sync',
  };
  const body = JSON.stringify({
    query: GET_MASTER_DATA_QUERY,
    variables: Object.fromEntries(
      Object.entries(variables).filter(([, v]) => v != null && v !== ''),
    ),
  });

  const url = resolveGraphqlUrl(base);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { getMasterData?: MasterDataResult };
      errors?: unknown[];
    };
    if (json.errors?.length) return null;
    const data = json.data?.getMasterData;
    if (!data) return null;
    const foodItems = (data.foodItems ?? []).map((f) => ({
      ...f,
      item_image: (f.item_image ?? f.itemImage ?? null) || null,
    }));
    return {
      ingredients: data.ingredients ?? [],
      foodGroups: data.foodGroups ?? [],
      foodItems,
      foodModifiers: data.foodModifiers ?? [],
    };
  } catch (err) {
    if (__DEV__) console.warn('[NResto] fetchMasterData failed', err);
    return null;
  }
}

/**
 * Persist master data to WatermelonDB and key_value (ingredients).
 * Maps API foodGroups → food_categories, foodItems → food_items, foodModifiers → food_modifiers.
 * Returns map of API food item id -> local DB record id for background image downloads.
 */
export async function persistMasterDataToDb(
  data: MasterDataResult,
): Promise<Map<string, string>> {
  const categoriesCollection = database.get<FoodCategory>('food_categories');
  const itemsCollection = database.get<FoodItem>('food_items');
  const modifiersCollection = database.get<FoodModifier>('food_modifiers');
  const apiItemIdToLocalRecordId = new Map<string, string>();

  await database.write(async () => {
    const existingCategories = await categoriesCollection.query().fetch();
    const existingItems = await itemsCollection.query().fetch();
    const existingModifiers = await modifiersCollection.query().fetch();
    await Promise.all([
      ...existingCategories.map(r => r.destroyPermanently()),
      ...existingItems.map(r => r.destroyPermanently()),
      ...existingModifiers.map(r => r.destroyPermanently()),
    ]);

    const groupIdToCategoryId = new Map<string, string>();

    for (const g of data.foodGroups) {
      const record = await categoriesCollection.create(cat => {
        cat.name = g.group_name;
        cat.sort_order = null;
        cat.group_id = null;
      });
      groupIdToCategoryId.set(g.id, record.id);
    }

    for (const f of data.foodItems) {
      const categoryId = groupIdToCategoryId.get(f.food_group_id);
      if (!categoryId) continue;
      const record = await itemsCollection.create(item => {
        item.item_name = f.item_name;
        item.description = f.description ?? '';
        item.price = f.price;
        item.status = f.status ?? true;
        item.category_id = categoryId;
        item.item_image_local = null;
      });
      apiItemIdToLocalRecordId.set(f.id, record.id);
    }

    for (const m of data.foodModifiers) {
      await modifiersCollection.create(mod => {
        mod.name = m.title;
        mod.price = m.price;
        mod.food_id = null;
      });
    }
  });

  await setPersistedSlice('masterData_ingredients', {
    ingredients: data.ingredients,
  } as unknown as Record<string, unknown>);

  return apiItemIdToLocalRecordId;
}

/** Generate a simple device id and persist it for future calls. */
export async function getOrCreateDeviceId(): Promise<string> {
  const raw = await getPersistedSlice('deviceId');
  const id = raw && typeof raw.id === 'string' ? raw.id : null;
  if (id) return id;
  const newId = `device-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
  await setPersistedSlice('deviceId', { id: newId });
  return newId;
}

/**
 * Load master data at app init. Ensures internet is reachable before calling the API;
 * if not reachable, skips the API call and all related steps (persist, image download).
 * When API is available: fetch, persist to DB, then start background image downloads.
 */
export async function loadMasterDataOnInit(params?: {
  deviceId?: string;
  userId?: string;
  description?: string;
}): Promise<void> {
  const base = (storeConfig.graphqlApiBase ?? '').trim();
  if (!base) {
    if (__DEV__)
      console.log('[NResto] Master data: skipped (no graphqlApiBase)');
    return;
  }

  // const reachable = await isInternetReachable();
  // if (!reachable) {
  //   if (__DEV__) console.log('[NResto] Master data: skipped (no internet)');
  //   return;
  // }

  if (__DEV__) console.log('[NResto] Master data: fetching from API...');
  const data = await fetchMasterData(params);
  if (data) {
    const apiItemIdToLocalRecordId = await persistMasterDataToDb(data);
    if (__DEV__)
      console.log(
        '[NResto] Master data: persisted',
        data.foodItems.length,
        'items',
      );
    const hasData =
      data.ingredients.length > 0 ||
      data.foodGroups.length > 0 ||
      data.foodItems.length > 0 ||
      data.foodModifiers.length > 0;
    if (hasData) {
      downloadMasterDataImagesInBackground(data, apiItemIdToLocalRecordId);
    }
  } else if (__DEV__) {
    console.log('[NResto] Master data: API returned no data');
  }
}
