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
import type Customer from '../database/Customer';
import { storeConfig } from '../constants/storeConfig';
import { downloadMasterDataImagesInBackground } from './masterDataImageService';

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
  /** API may return string or number */
  price?: number | string | null;
  quantity?: number | string | null;
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
  /** Relative path or URL (e.g. `/uploads/seed/item.jpg`) */
  item_image?: string | null;
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

/** From getMasterData.customerList (auth gRPC; may be empty). */
export interface MasterDataCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface MasterDataResult {
  ingredients: MasterDataIngredient[];
  foodGroups: MasterDataFoodGroup[];
  foodItems: MasterDataFoodItem[];
  foodModifiers: MasterDataFoodModifier[];
  customerList: MasterDataCustomer[];
}

type MasterDataPayload = {
  getMasterData?: MasterDataResult | null;
  masterData?: MasterDataResult | null;
};

/** Matches Food Service `getMasterData` (see FE API doc). */
const GET_MASTER_DATA_QUERY = `
query GetMasterData($deviceId: String, $userId: String, $description: String, $companyId: String) {
  getMasterData(deviceId: $deviceId, userId: $userId, description: $description, companyId: $companyId) {
    ingredients { id item_name description price quantity unit alert_quantity created_by created_at updated_at }
    foodGroups { id group_name food_group_image status created_by created_at updated_at }
    foodItems { id item_name description price item_image food_group_id status created_by created_at updated_at foodGroup { id group_name } }
    foodModifiers { id title price ingredient_item created_by created_at updated_at }
    customerList { id name email phone address city state zip country }
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
  companyId?: string;
}): Promise<MasterDataResult | null> {
  const base = (storeConfig.graphqlApiBase ?? '').trim();
  if (!base) return null;

  const variables: Record<string, string | undefined> = {
    deviceId: params?.deviceId,
    userId: params?.userId,
    description: params?.description ?? 'Master data sync',
    companyId: (params?.companyId ?? (storeConfig.masterDataCompanyId ?? '').trim()) || undefined,
  };
  const filteredVars = Object.fromEntries(
    Object.entries(variables).filter(([, v]) => v != null && v !== ''),
  );
  const url = resolveGraphqlUrl(base);

  const parsePayload = (json: {
    data?: MasterDataPayload;
    getMasterData?: MasterDataResult | null;
    masterData?: MasterDataResult | null;
  }): MasterDataResult | null => {
    return (
      json.data?.getMasterData ??
      json.data?.masterData ??
      json.getMasterData ??
      json.masterData ??
      null
    );
  };

  const doFetch = async (sendVariables: boolean): Promise<MasterDataResult | null> => {
    const body = JSON.stringify({
      query: GET_MASTER_DATA_QUERY,
      ...(sendVariables ? { variables: filteredVars } : {}),
    });
    if (__DEV__) {
      console.log(
        '[NResto] fetchMasterData request',
        JSON.stringify({ url, sendVariables, variables: sendVariables ? filteredVars : {} }),
      );
    }
    const auth = (storeConfig.graphqlAuthorization ?? '').trim();
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(auth ? { Authorization: auth } : {}),
      },
      body,
    });
    const raw = await res.text();
    if (!res.ok) {
      if (__DEV__) {
        console.warn(
          '[NResto] fetchMasterData HTTP error',
          res.status,
          res.statusText,
          raw.slice(0, 500),
        );
      }
      return null;
    }
    if (__DEV__) {
      console.log('[NResto] fetchMasterData HTTP success', res.status, raw.slice(0, 800));
    }
    let json: {
      data?: MasterDataPayload;
      getMasterData?: MasterDataResult | null;
      masterData?: MasterDataResult | null;
      errors?: unknown[];
    };
    try {
      json = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn('[NResto] fetchMasterData invalid JSON', raw.slice(0, 500));
      }
      return null;
    }
    if (json.errors?.length) {
      if (__DEV__) {
        console.warn('[NResto] fetchMasterData GraphQL errors', JSON.stringify(json.errors).slice(0, 800));
      }
      return null;
    }
    const data = parsePayload(json);
    if (!data) {
      if (__DEV__) {
        console.warn('[NResto] fetchMasterData no data field found in response');
      }
      return null;
    }
    if (__DEV__) {
      console.log(
        '[NResto] fetchMasterData parsed counts',
        JSON.stringify({
          ingredients: data.ingredients?.length ?? 0,
          foodGroups: data.foodGroups?.length ?? 0,
          foodItems: data.foodItems?.length ?? 0,
          foodModifiers: data.foodModifiers?.length ?? 0,
          customerList: data.customerList?.length ?? 0,
        }),
      );
    }
    const foodItems = (data.foodItems ?? []).map((f) => ({
      ...f,
      item_image: f.item_image ?? null,
    }));
    return {
      ingredients: data.ingredients ?? [],
      foodGroups: data.foodGroups ?? [],
      foodItems,
      foodModifiers: data.foodModifiers ?? [],
      customerList: data.customerList ?? [],
    };
  };

  try {
    // First try with variables; some backends reject optional vars unexpectedly.
    const withVars = await doFetch(true);
    if (withVars) return withVars;

    // Fallback: same query without variables block.
    const withoutVars = await doFetch(false);
    if (withoutVars) return withoutVars;
    return null;
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
  const customersCollection = database.get<Customer>('customers');
  const apiItemIdToLocalRecordId = new Map<string, string>();

  await database.write(async () => {
    const existingCategories = await categoriesCollection.query().fetch();
    const existingItems = await itemsCollection.query().fetch();
    const existingModifiers = await modifiersCollection.query().fetch();
    const existingCustomers = await customersCollection.query().fetch();
    await Promise.all([
      ...existingCategories.map(r => r.destroyPermanently()),
      ...existingItems.map(r => r.destroyPermanently()),
      ...existingModifiers.map(r => r.destroyPermanently()),
      ...existingCustomers.map(r => r.destroyPermanently()),
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
        const p = f.price as unknown;
        item.price =
          typeof p === 'number' && Number.isFinite(p) ? p : Number(p) || 0;
        item.status = f.status ?? true;
        item.category_id = categoryId;
        item.item_image_local = null;
        item.pos_meta = null;
      });
      apiItemIdToLocalRecordId.set(f.id, record.id);
    }

    for (const m of data.foodModifiers) {
      await modifiersCollection.create(mod => {
        mod.name = m.title;
        const p = m.price as unknown;
        mod.price =
          typeof p === 'number' && Number.isFinite(p) ? p : Number(p) || 0;
        mod.food_id = null;
      });
    }

    for (const c of data.customerList ?? []) {
      const name = (c.name ?? '').trim();
      if (!name) continue;
      await customersCollection.create((row) => {
        row.name = name;
        row.phone = c.phone != null && String(c.phone).trim() ? String(c.phone) : null;
        row.email = c.email != null && String(c.email).trim() ? String(c.email) : null;
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
  companyId?: string;
}): Promise<void> {
  const base = (storeConfig.graphqlApiBase ?? '').trim();
  if (!base) {
    if (__DEV__)
      console.log('[NResto] Master data: skipped (no graphqlApiBase)');
    return;
  }

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
      data.foodModifiers.length > 0 ||
      data.customerList.length > 0;
    if (hasData) {
      downloadMasterDataImagesInBackground(data, apiItemIdToLocalRecordId);
    }
  } else if (__DEV__) {
    console.log(
      '[NResto] Master data: API returned no data. Check previous fetch logs for HTTP/GraphQL details and verify graphqlApiBase.',
      resolveGraphqlUrl(base),
    );
  }
}
