import type Order from '../database/Order';

/** Start of local calendar day (00:00) for `dayRef` in local timezone. */
export function startOfLocalDayMs(dayRef: Date = new Date()): number {
  const d = new Date(dayRef);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfLocalDayMs(dayRef: Date = new Date()): number {
  const d = new Date(dayRef);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * “Completed” for dashboard: paid (preferred via paid_at) or delivered same day.
 * Handles legacy rows without paid_at.
 */
export function isOrderCompletedInLocalDay(
  order: Order,
  dayStartMs: number,
  dayEndMs: number
): boolean {
  const st = (order.status ?? '').toUpperCase();
  const paidAt = order.paid_at;
  if (paidAt != null && paidAt >= dayStartMs && paidAt <= dayEndMs) {
    return true;
  }
  if (st === 'PAID' && order.created_at >= dayStartMs && order.created_at <= dayEndMs) {
    return true;
  }
  if (st === 'DELIVERED' && order.created_at >= dayStartMs && order.created_at <= dayEndMs) {
    return true;
  }
  return false;
}
