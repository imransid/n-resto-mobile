/**
 * When the device is online, uploads **pending** orders from `order_sync_queue` to the backend.
 * On 2xx: mark `orders.order_sync_status = true`, dequeue, then delete local synced rows except the newest
 * `KEEP_LAST_ORDERS_LOCAL` kept for the Orders screen.
 *
 * - Foreground: native connectivity thread + debounced JS (see `startOrderBackgroundSync`).
 * - Android background / after kill: WorkManager → Headless JS → same function with `bypassThrottle`.
 */
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database/databaseInstance';
import type Order from '../database/Order';
import type OrderSyncQueue from '../database/OrderSyncQueue';
import { storeConfig } from '../constants/storeConfig';
import { getOrCreateDeviceId } from './masterDataService';
import { isInternetReachable } from './networkService';
import {
  setAndroidBackgroundWorkEnabled,
  subscribeToConnectivity,
} from '../native/orderSyncMonitor';

const DEBOUNCE_MS = 3500;
const MIN_INTERVAL_BETWEEN_RUNS_MS = 12_000;
const FETCH_TIMEOUT_MS = 55_000;
/** After a successful POST, always keep this many newest orders in SQLite for the Orders UI. */
const KEEP_LAST_ORDERS_LOCAL = 5;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncInFlight = false;
let lastRunFinishedAt = 0;
let unsubscribeConnectivity: (() => void) | null = null;
let appStateSub: { remove: () => void } | null = null;
let lastAppState: AppStateStatus = AppState.currentState;

/**
 * Sync trace logs. Android always (logcat tag ReactNativeJS) so release/debug builds show why
 * background/headless did or didn’t POST; iOS only in __DEV__ to avoid console noise in TestFlight.
 */
function syncDbg(message: string, ...args: unknown[]) {
  if (__DEV__ || Platform.OS === 'android') {
    console.log(`[OrderSync] ${message}`, ...args);
  }
}

function clearDebounce() {
  if (debounceTimer != null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function scheduleSync(reason: string) {
  clearDebounce();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runOrderUploadAndClear(reason);
  }, DEBOUNCE_MS);
}

/** Debounced upload (batches rapid outbox writes). */
export function scheduleOrderSync(reason = 'order_completed'): void {
  scheduleSync(reason);
}

/** Try upload immediately (bypasses 12s throttle). Safe when another sync is running — that path schedules a follow-up. */
export function requestOrderUploadNow(reason = 'order_completed'): void {
  void runOrderUploadAndClear(reason, { bypassThrottle: true });
}

function ordersSyncUrl(): string {
  const base = (storeConfig.ordersSyncUrl ?? '').trim();
  if (
    Platform.OS === 'android' &&
    (base.includes('localhost') || base.includes('127.0.0.1'))
  ) {
    return base.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  return base;
}

function ordersAuthHeader(): string | undefined {
  const a = (storeConfig.ordersSyncAuthorization ?? '').trim();
  const b = (storeConfig.graphqlAuthorization ?? '').trim();
  const v = a || b;
  return v || undefined;
}

/**
 * Strict backends often allow only a few `reason` values. Internal triggers (e.g. `order_completed`)
 * are mapped so the POST body validates; logs still use the real trigger.
 */
function orderSyncReasonForApi(reason: string): 'connectivity' | 'cold_start' | 'manual' {
  if (reason === 'manual') return 'manual';
  if (reason === 'cold_start') return 'cold_start';
  return 'connectivity';
}

function orderRowToJson(order: Order) {
  return {
    localId: order.id,
    createdAt: order.created_at,
    total: order.total,
    paymentMethod: order.payment_method,
    orderType: order.order_type,
    tableNumber: order.table_number,
    customerName: order.customer_name,
    orderNotes: order.order_notes,
    status: order.status,
    createdBy: order.created_by,
    companyId: order.company_id,
    itemsRaw: order.items,
    items: order.itemsParsed,
  };
}

export type OrderSyncRunOptions = {
  /** Skip min-interval guard (Headless / WorkManager). In-flight guard still applies. */
  bypassThrottle?: boolean;
};

/**
 * Upload **pending queue** orders only (`order_sync_queue`).
 * On 2xx: mark rows synced; dequeue; delete synced `orders` rows except the **newest KEEP_LAST_ORDERS_LOCAL** kept for UI.
 */
export async function runOrderUploadAndClear(
  reason = 'manual',
  opts?: OrderSyncRunOptions
): Promise<void> {
  const url = ordersSyncUrl();
  if (!url) {
    syncDbg('skipped (no ordersSyncUrl / ORDERS_SYNC_URL)');
    return;
  }

  const now = Date.now();
  if (syncInFlight) {
    syncDbg('skipped (sync already in flight) — will retry via debounce', { reason });
    scheduleSync(`queue_after_inflight_${reason}`);
    return;
  }
  const bypass = opts?.bypassThrottle === true;
  if (
    !bypass &&
    now - lastRunFinishedAt < MIN_INTERVAL_BETWEEN_RUNS_MS &&
    reason !== 'manual'
  ) {
    const waitMs = MIN_INTERVAL_BETWEEN_RUNS_MS - (now - lastRunFinishedAt);
    syncDbg('skipped (throttle)', {
      reason,
      retryInMs: Math.max(0, waitMs),
      hint: 'use reason "manual" or bypassThrottle: true',
    });
    return;
  }

  const ordersCollection = database.get<Order>('orders');
  const queueCollection = database.get<OrderSyncQueue>('order_sync_queue');

  const queuePending = await queueCollection.query().fetchCount();
  if (queuePending === 0) {
    syncDbg('skipped (nothing in order_sync_queue — nothing pending upload)', { reason });
    return;
  }

  const reachable = await isInternetReachable();
  if (!reachable) {
    syncDbg('skipped (network not reachable)', { reason, queuePending });
    return;
  }

  let queueRows = await queueCollection.query().fetch();
  if (queueRows.length === 0) {
    syncDbg('skipped (queue empty after fetch)', { reason });
    return;
  }

  const orderIds = [...new Set(queueRows.map((q) => q.order_id))];
  const rows =
    orderIds.length > 0
      ? await ordersCollection.query(Q.where('id', Q.oneOf(orderIds))).fetch()
      : [];
  const rowById = new Map(rows.map((r) => [r.id, r]));

  const staleQueue = queueRows.filter((q) => !rowById.has(q.order_id));
  if (staleQueue.length > 0) {
    await database.write(async () => {
      for (const q of staleQueue) {
        await q.destroyPermanently();
      }
    });
    queueRows = queueRows.filter((q) => rowById.has(q.order_id));
  }

  const rowsToSend = orderIds
    .map((id) => rowById.get(id))
    .filter((o): o is Order => o != null)
    .filter((o) => (o.status ?? '') === 'PAID')
    .sort((a, b) => a.created_at - b.created_at);

  if (rowsToSend.length === 0) {
    syncDbg('skipped (no PAID orders to send — queue has only unpaid or stale)', { reason });
    return;
  }

  syncInFlight = true;
  try {
    let deviceId: string | null = null;
    try {
      deviceId = await getOrCreateDeviceId();
    } catch {
      deviceId = null;
    }

    const body = {
      deviceId,
      reason: orderSyncReasonForApi(reason),
      syncedAt: new Date().toISOString(),
      orders: rowsToSend.map(orderRowToJson),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
    const auth = ordersAuthHeader();
    if (auth) headers.Authorization = auth;

    syncDbg('POST', {
      reason: body.reason,
      trigger: reason,
      orderCount: rowsToSend.length,
      url: url.length > 80 ? `${url.slice(0, 77)}…` : url,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.warn('[OrderSync] server error', res.status, t.slice(0, 400));
      return;
    }

    const syncedIds = new Set(rowsToSend.map((r) => r.id));

    await database.write(async () => {
      for (const id of syncedIds) {
        try {
          const order = await ordersCollection.find(id);
          await order.update((r) => {
            r.order_sync_status = true;
          });
        } catch {
          /* already gone */
        }
      }

      const allOrders = await ordersCollection.query().fetch();
      const sortedByNewest = [...allOrders].sort((a, b) => b.created_at - a.created_at);
      const protectedIds = new Set(
        sortedByNewest.slice(0, KEEP_LAST_ORDERS_LOCAL).map((o) => o.id)
      );

      for (const id of syncedIds) {
        if (!protectedIds.has(id)) {
          try {
            const o = await ordersCollection.find(id);
            if (o.order_sync_status === true) {
              await o.destroyPermanently();
            }
          } catch {
            /* already gone */
          }
        }
      }

      for (const q of queueRows) {
        if (syncedIds.has(q.order_id)) {
          await q.destroyPermanently();
        }
      }
    });

    syncDbg('uploaded & dequeued (kept newest local history)', {
      posted: rowsToSend.length,
      keptLocal: KEEP_LAST_ORDERS_LOCAL,
      reason,
    });
  } catch (e) {
    console.warn('[OrderSync] failed', e);
  } finally {
    syncInFlight = false;
    lastRunFinishedAt = Date.now();
    const qc = database.get<OrderSyncQueue>('order_sync_queue');
    void qc
      .query()
      .fetchCount()
      .then((remaining) => {
        if (remaining > 0) {
          syncDbg('queue still has pending — scheduling drain', { remaining, reason });
          scheduleSync(`drain_after_${reason}`);
        }
      })
      .catch(() => {});
  }
}

let syncListenersActive = false;

/**
 * When `ordersSyncUrl` is empty: no native network monitor, no AppState listener, no WorkManager
 * (Android) — avoids threads, callbacks, and headless wakes. When URL is set: full pipeline.
 *
 * Idempotent: second call while already active is a no-op (avoids duplicate listeners if invoked twice).
 */
export function startOrderBackgroundSync(): () => void {
  if (syncListenersActive) {
    return () => {};
  }

  clearDebounce();

  const urlConfigured = ordersSyncUrl().length > 0;
  setAndroidBackgroundWorkEnabled(urlConfigured);

  if (!urlConfigured) {
    syncDbg('listeners not attached (no ordersSyncUrl)');
    return () => {
      setAndroidBackgroundWorkEnabled(false);
    };
  }

  syncListenersActive = true;
  syncDbg('foreground listeners + Android WorkManager enabled');

  unsubscribeConnectivity = subscribeToConnectivity((online) => {
    if (online) {
      scheduleSync('connectivity');
    }
  });

  const coldStartTimer = setTimeout(() => {
    void (async () => {
      if (await isInternetReachable()) {
        scheduleSync('cold_start');
      }
    })();
  }, 5000);

  /** Foreground catch-up (esp. iOS) without extra native code. */
  const onAppState = (next: AppStateStatus) => {
    if (lastAppState.match(/inactive|background/) && next === 'active') {
      scheduleSync('app_foreground');
    }
    lastAppState = next;
  };
  appStateSub = AppState.addEventListener('change', onAppState);

  return () => {
    syncListenersActive = false;
    clearDebounce();
    clearTimeout(coldStartTimer);
    unsubscribeConnectivity?.();
    unsubscribeConnectivity = null;
    appStateSub?.remove();
    appStateSub = null;
    setAndroidBackgroundWorkEnabled(false);
  };
}
