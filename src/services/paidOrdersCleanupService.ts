/**
 * Deletes PAID orders older than 5 hours from the local DB.
 * Runs on app foreground only, throttled to avoid performance impact.
 */
import { AppState, type AppStateStatus, InteractionManager, Platform } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database/databaseInstance';
import type Order from '../database/Order';
import type OrderSyncQueue from '../database/OrderSyncQueue';

const PAID_ORDER_RETENTION_MS = 5 * 60 * 60 * 1000; // 5 hours
const MIN_INTERVAL_BETWEEN_CLEANUPS_MS = 30 * 60 * 1000; // 30 min throttle

let lastCleanupAt = 0;
let appStateSub: { remove: () => void } | null = null;
let cleanupActive = false;

function cleanupDbg(message: string, ...args: unknown[]) {
  if (__DEV__ || Platform.OS === 'android') {
    console.log(`[PaidOrdersCleanup] ${message}`, ...args);
  }
}

/**
 * Delete PAID orders where paid_at is older than 5 hours.
 * Uses DB-level filter (no in-memory scan). Removes order_sync_queue rows.
 */
export async function runPaidOrdersCleanup(): Promise<number> {
  const cutoff = Date.now() - PAID_ORDER_RETENTION_MS;
  const ordersCollection = database.get<Order>('orders');
  const queueCollection = database.get<OrderSyncQueue>('order_sync_queue');

  const toDelete = await ordersCollection
    .query(
      Q.and(Q.where('status', 'PAID'), Q.where('paid_at', Q.lt(cutoff)))
    )
    .fetch();

  if (toDelete.length === 0) return 0;

  const idsToDelete = toDelete.map((o) => o.id);
  const queueRows =
    idsToDelete.length > 0
      ? await queueCollection
          .query(Q.where('order_id', Q.oneOf(idsToDelete)))
          .fetch()
      : [];

  await database.write(async () => {
    for (const o of toDelete) {
      await o.destroyPermanently();
    }
    for (const q of queueRows) {
      await q.destroyPermanently();
    }
  });

  return toDelete.length;
}

function maybeRunCleanup() {
  const now = Date.now();
  if (now - lastCleanupAt < MIN_INTERVAL_BETWEEN_CLEANUPS_MS) return;
  if (cleanupActive) return;

  cleanupActive = true;
  lastCleanupAt = now;
  runPaidOrdersCleanup()
    .then((deleted) => {
      if (deleted > 0) cleanupDbg('deleted old paid orders', { count: deleted });
    })
    .catch((e) => {
      if (__DEV__) console.warn('[PaidOrdersCleanup] failed', e);
    })
    .finally(() => {
      cleanupActive = false;
    });
}

/**
 * Subscribe to app foreground and run cleanup (throttled).
 * Call once at app init. Returns unsubscribe.
 */
export function startPaidOrdersCleanup(): () => void {
  if (appStateSub) return () => {};

  const onAppState = (next: AppStateStatus) => {
    if (next === 'active') maybeRunCleanup();
  };
  appStateSub = AppState.addEventListener('change', onAppState);

  // Run once after UI is idle (avoids blocking startup)
  const initHandle = InteractionManager.runAfterInteractions(() => {
    setTimeout(maybeRunCleanup, 2000);
  });

  return () => {
    initHandle.cancel();
    appStateSub?.remove();
    appStateSub = null;
  };
}
