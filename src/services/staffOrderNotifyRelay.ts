import { getPersistedSlice } from '../database';
import { parseAuth } from './authService';
import { storeConfig } from '../constants/storeConfig';
import { isAdminRole } from '../utils/userRole';

const RELAY_TIMEOUT_MS = 12_000;

/**
 * Optional webhook: when a non-admin user submits an order, POST a small payload so your backend
 * can fan out FCM/APNs to admin devices. Set `STAFF_ORDER_NOTIFY_URL` in `.env`.
 */
export async function maybeNotifyRelayForNewOrder(payload: {
  localOrderId: string;
  total: number;
  companyId: string;
  createdBy: string;
}): Promise<void> {
  const url = (storeConfig.staffOrderNotifyUrl ?? '').trim();
  if (!url) return;

  let raw: Record<string, unknown> | null;
  try {
    raw = await getPersistedSlice('auth');
  } catch {
    return;
  }
  const auth = parseAuth(raw);
  if (!auth.user?.id || isAdminRole(auth.user.role)) return;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  const authHdr = (storeConfig.staffOrderNotifyAuthorization ?? '').trim();
  if (authHdr) headers.Authorization = authHdr;

  const body = JSON.stringify({
    event: 'staff_order_submitted',
    localOrderId: payload.localOrderId,
    total: payload.total,
    companyId: payload.companyId || null,
    createdBy: payload.createdBy || null,
    submittedByUserId: auth.user.id,
    submittedByRole: auth.user.role ?? null,
  });

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), RELAY_TIMEOUT_MS);
  try {
    await fetch(url, { method: 'POST', headers, body, signal: ctrl.signal });
  } catch (e) {
    if (__DEV__) console.warn('[NResto] staffOrderNotifyRelay failed', e);
  } finally {
    clearTimeout(t);
  }
}
