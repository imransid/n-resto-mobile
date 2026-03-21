import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database/databaseInstance';
import type Order from '../database/Order';
import { useAuth } from '../hooks/useAuth';
import { isAdminRole } from '../utils/userRole';
import { resolveSessionCompanyId } from '../utils/sessionCompanyId';
import {
  requestAdminNotificationPermission,
  showAdminNewStaffOrderNotification,
} from '../services/adminLocalNotifications';

/**
 * Admins: watch local DB for **new** order rows attributed to another user (typical staff id).
 * Use with optional `STAFF_ORDER_NOTIFY_URL` relay + server FCM for other devices.
 */
export default function AdminOrderNotificationBridge() {
  const { auth } = useAuth();
  const knownIdsRef = useRef<Set<string> | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    if (!auth.isAuthenticated || !isAdminRole(auth.user?.role)) {
      return;
    }

    primedRef.current = false;
    knownIdsRef.current = null;

    requestAdminNotificationPermission().catch(() => undefined);

    const companyId = resolveSessionCompanyId(auth);
    const ordersCol = database.get<Order>('orders');
    const q = companyId ? ordersCol.query(Q.where('company_id', companyId)) : ordersCol.query();

    const handleRows = (rows: Order[]) => {
      const myId = (auth.user?.id ?? '').trim();
      if (!primedRef.current) {
        const set = new Set<string>();
        rows.forEach((r) => set.add(r.id));
        knownIdsRef.current = set;
        primedRef.current = true;
        return;
      }
      const known = knownIdsRef.current ?? new Set<string>();
      for (const r of rows) {
        if (known.has(r.id)) continue;
        known.add(r.id);
        const by = (r.created_by ?? '').trim();
        if (by && myId && by !== myId) {
          showAdminNewStaffOrderNotification({
            orderId: r.id,
            total: r.total,
            customerName: r.customer_name ?? undefined,
          }).catch(() => undefined);
        }
      }
      knownIdsRef.current = known;
    };

    const sub = q.observe().subscribe(handleRows);

    const onAppState = (s: AppStateStatus) => {
      if (s === 'active') {
        /** Avoid duplicate toasts after long background: re-sync known set once. */
        q.fetch()
          .then((rows) => {
            if (!knownIdsRef.current) return;
            rows.forEach((r) => knownIdsRef.current!.add(r.id));
          })
          .catch(() => {});
      }
    };
    const appSub = AppState.addEventListener('change', onAppState);

    return () => {
      sub.unsubscribe();
      appSub.remove();
      primedRef.current = false;
      knownIdsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe using explicit auth fields only
  }, [
    auth.isAuthenticated,
    auth.user?.id,
    auth.user?.role,
    auth.user?.companyId,
    auth.company?.id,
  ]);

  return null;
}
