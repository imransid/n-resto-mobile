import { Q } from '@nozbe/watermelondb';
import { database } from '../database/databaseInstance';
import type KeyValue from '../database/KeyValue';

const KEY = 'pos_published_catalog';

export interface PosPublishedCatalogMeta {
  posId: string;
  version: number;
  publishedAt: string;
  currency: string;
}

/** Meta written when default menu seed runs; use for sync / “menu updated” checks vs API. */
export async function getPosPublishedCatalogMeta(): Promise<PosPublishedCatalogMeta | null> {
  try {
    const rows = await database
      .get<KeyValue>('key_value')
      .query(Q.where('key', KEY))
      .fetch();
    const raw = rows[0]?.value;
    if (raw == null || !String(raw).trim()) return null;
    return JSON.parse(raw) as PosPublishedCatalogMeta;
  } catch {
    return null;
  }
}
