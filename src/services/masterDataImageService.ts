/**
 * Download master data images on a native background thread: create app-named folder
 * in Documents, download each item image with filename = item id, then update DB.
 * Uses native ImageDownload module (Android: ExecutorService, iOS: dispatch_async).
 */
import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { database } from '../database/databaseInstance';
import type FoodItem from '../database/FoodItem';
import { storeConfig } from '../constants/storeConfig';
import type { MasterDataFoodItem, MasterDataResult } from './masterDataService';

const APP_FOLDER_NAME = 'NRestoMobile';

const ImageDownloadNative =
  NativeModules.ImageDownload as {
    downloadImages: (
      items: { imageUrl: string; itemId: string }[],
      imagesDir?: string,
      authorization?: string | null,
    ) => Promise<{ itemId: string; localPath: string }[]>;
  } | undefined;

/**
 * Same rule as GraphQL: Android emulator cannot reach host `localhost`; use 10.0.2.2.
 * Image URLs are built from assets base — they must be rewritten too or downloads fail silently.
 */
function resolveHostForDevice(url: string): string {
  if (Platform.OS === 'android' && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return url.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  return url;
}

function getAssetsBaseUrl(): string {
  const base = (storeConfig.assetsBaseUrl ?? '').trim();
  if (base) return resolveHostForDevice(base.replace(/\/$/, ''));
  const graphql = (storeConfig.graphqlApiBase ?? '').trim();
  if (graphql) return resolveHostForDevice(graphql.replace(/\/graphql\/?$/, ''));
  return '';
}

function resolveImageUrl(itemImage: string): string {
  const trimmed = (itemImage || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return resolveHostForDevice(trimmed);
  const base = getAssetsBaseUrl();
  if (!base) return trimmed;
  // Food Service contract: item_image is filename only → /uploads/food-items/<filename>
  if (trimmed.startsWith('/')) {
    return resolveHostForDevice(`${base}${trimmed}`);
  }
  if (!trimmed.includes('/')) {
    return resolveHostForDevice(`${base}/uploads/food-items/${trimmed}`);
  }
  const path = `/${trimmed}`;
  return resolveHostForDevice(`${base}${path}`);
}

function downloadAuthHeaders(): Record<string, string> | undefined {
  const auth = (storeConfig.graphqlAuthorization ?? '').trim();
  return auth ? { Authorization: auth } : undefined;
}

function getExtension(url: string): string {
  const match = /\.([a-zA-Z0-9]+)(?:\?|$)/.exec(url);
  return match ? `.${match[1].toLowerCase()}` : '.jpg';
}

/**
 * Create app folder in document directory. Returns full path.
 */
export function getAppImagesDir(): string {
  const docs = RNFS.DocumentDirectoryPath;
  return `${docs}/${APP_FOLDER_NAME}`;
}

/**
 * Ensure app folder exists. Resolves when done.
 */
async function ensureAppImagesDir(): Promise<string> {
  const dir = getAppImagesDir();
  const exists = await RNFS.exists(dir);
  if (!exists) await RNFS.mkdir(dir);
  return dir;
}

/** Fallback: download one image via RNFS (runs on JS thread). */
async function downloadImageFallback(
  imageUrl: string,
  itemId: string,
  dir: string
): Promise<string | null> {
  const ext = getExtension(imageUrl);
  const safeId = itemId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeId}${ext}`;
  const toFile = `${dir}/${filename}`;
  try {
    const headers = downloadAuthHeaders();
    const result = await RNFS.downloadFile({
      fromUrl: imageUrl,
      toFile,
      ...(headers ? { headers } : {}),
    }).promise;
    if (result.statusCode === 200) return toFile;
    if (__DEV__) {
      console.warn('[NResto] Image RNFS download non-200', imageUrl.slice(0, 120), result.statusCode);
    }
    return null;
  } catch (e) {
    if (__DEV__) console.warn('[NResto] Image RNFS download failed', imageUrl.slice(0, 120), e);
    return null;
  }
}

/**
 * Apply downloaded results to DB: update each food_items record's item_image_local.
 */
async function applyDownloadResultsToDb(
  results: { itemId: string; localPath: string }[],
  apiItemIdToLocalRecordId: Map<string, string>
): Promise<void> {
  if (results.length === 0) return;
  const itemsCollection = database.get<FoodItem>('food_items');
  let updated = 0;
  for (const { itemId, localPath } of results) {
    const localRecordId = apiItemIdToLocalRecordId.get(itemId);
    if (!localRecordId) {
      if (__DEV__) console.warn('[NResto] Image save: no DB record for itemId', itemId);
      continue;
    }
    try {
      await database.write(async () => {
        const record = await itemsCollection.find(localRecordId);
        await record.update((r) => {
          r.item_image_local = localPath;
        });
      });
      updated += 1;
    } catch (e) {
      if (__DEV__) console.warn('[NResto] Image save: DB update failed', itemId, e);
    }
  }
  if (__DEV__) console.log('[NResto] Image save: updated', updated, 'of', results.length, 'in DB');
}

/**
 * Run in background: downloads run on a native background thread (Android ExecutorService,
 * iOS dispatch_async). When native module is unavailable, falls back to RNFS on JS.
 * apiItemIdToLocalRecordId maps API item id -> WatermelonDB record id.
 */
export function downloadMasterDataImagesInBackground(
  data: MasterDataResult,
  apiItemIdToLocalRecordId: Map<string, string>
): void {
  const itemsWithImage = data.foodItems.filter(
    (f: MasterDataFoodItem) => f.item_image && String(f.item_image).trim()
  );
  if (itemsWithImage.length === 0) {
    if (__DEV__) console.log('[NResto] Image download: no items with item_image');
    return;
  }

  if (__DEV__) {
    const firstUrl = resolveImageUrl(itemsWithImage[0].item_image!);
    console.log('[NResto] Image download: starting', itemsWithImage.length, 'items, first URL:', firstUrl || '(empty)');
  }

  (async () => {
    try {
      const dir = await ensureAppImagesDir();
      const auth = (storeConfig.graphqlAuthorization ?? '').trim() || null;

      const items = itemsWithImage
        .map((f: MasterDataFoodItem) => {
          const imageUrl = resolveImageUrl(f.item_image!);
          return imageUrl ? { imageUrl, itemId: f.id } : null;
        })
        .filter((x): x is { imageUrl: string; itemId: string } => x != null);

      if (items.length === 0) return;

      const merged = new Map<string, string>();

      if (ImageDownloadNative?.downloadImages && Platform.OS !== 'web') {
        try {
          const nativeResults = await ImageDownloadNative.downloadImages(items, dir, auth);
          for (const r of nativeResults ?? []) {
            if (r.itemId && r.localPath) merged.set(r.itemId, r.localPath);
          }
          if (__DEV__) {
            console.log('[NResto] Image download: native completed', nativeResults?.length ?? 0, '/', items.length);
          }
        } catch (e) {
          if (__DEV__) console.warn('[NResto] Image download: native module failed, will try RNFS', e);
        }
      }

      if (merged.size < items.length) {
        if (__DEV__ && merged.size === 0) {
          console.log('[NResto] Image download: using RNFS for', items.length, 'item(s)');
        } else if (__DEV__) {
          console.log('[NResto] Image download: RNFS filling', items.length - merged.size, 'missing');
        }
        for (const { imageUrl, itemId } of items) {
          if (merged.has(itemId)) continue;
          const localPath = await downloadImageFallback(imageUrl, itemId, dir);
          if (localPath) merged.set(itemId, localPath);
        }
      }

      const results = [...merged.entries()].map(([itemId, localPath]) => ({ itemId, localPath }));
      if (results.length > 0) await applyDownloadResultsToDb(results, apiItemIdToLocalRecordId);
      else if (__DEV__) {
        console.warn(
          '[NResto] Image download: 0 files saved. Check URLs (Android: use 10.0.2.2 not localhost), cleartext, and auth.',
          items[0]?.imageUrl,
        );
      }
    } catch (e) {
      if (__DEV__) console.warn('[NResto] Image download failed', e);
    }
  })();
}
