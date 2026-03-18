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
    downloadImages: (items: { imageUrl: string; itemId: string }[], imagesDir?: string) => Promise<{ itemId: string; localPath: string }[]>;
  } | undefined;

function getAssetsBaseUrl(): string {
  const base = (storeConfig.assetsBaseUrl ?? '').trim();
  if (base) return base.replace(/\/$/, '');
  const graphql = (storeConfig.graphqlApiBase ?? '').trim();
  if (graphql) return graphql.replace(/\/graphql\/?$/, '');
  return '';
}

function resolveImageUrl(itemImage: string): string {
  const trimmed = (itemImage || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const base = getAssetsBaseUrl();
  if (!base) return trimmed;
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
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
    const result = await RNFS.downloadFile({ fromUrl: imageUrl, toFile }).promise;
    if (result.statusCode === 200) return toFile;
    return null;
  } catch {
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
    if (__DEV__) console.log('[NResto] Image download: no items with item_image (API may use itemImage or omit URLs)');
    return;
  }

  if (__DEV__) {
    const firstUrl = resolveImageUrl(itemsWithImage[0].item_image!);
    console.log('[NResto] Image download: starting', itemsWithImage.length, 'items, first URL:', firstUrl || '(empty)');
  }

  (async () => {
    try {
      const dir = await ensureAppImagesDir();

      if (ImageDownloadNative?.downloadImages && Platform.OS !== 'web') {
        const items = itemsWithImage
          .map((f: MasterDataFoodItem) => {
            const imageUrl = resolveImageUrl(f.item_image!);
            return imageUrl ? { imageUrl, itemId: f.id } : null;
          })
          .filter((x): x is { imageUrl: string; itemId: string } => x != null);
        if (items.length > 0) {
          const results = await ImageDownloadNative.downloadImages(items, dir);
          if (__DEV__) console.log('[NResto] Image download: native completed', results.length, 'files');
          await applyDownloadResultsToDb(results, apiItemIdToLocalRecordId);
        }
        return;
      }

      if (__DEV__) console.log('[NResto] Image download: using RNFS fallback');

      const itemsCollection = database.get<FoodItem>('food_items');
      const results: { itemId: string; localPath: string }[] = [];
      for (const f of itemsWithImage) {
        const imageUrl = resolveImageUrl(f.item_image!);
        if (!imageUrl) continue;
        const localPath = await downloadImageFallback(imageUrl, f.id, dir);
        if (!localPath) continue;
        results.push({ itemId: f.id, localPath });
      }
      if (results.length > 0) await applyDownloadResultsToDb(results, apiItemIdToLocalRecordId);
    } catch (e) {
      if (__DEV__) console.warn('[NResto] Image download failed', e);
    }
  })();
}
