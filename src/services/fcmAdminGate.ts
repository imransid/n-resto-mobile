/**
 * Push (FCM) is intended for ADMIN users only.
 * Uses persisted auth so background/headless handlers can gate safely.
 */
import { getPersistedSlice } from '../database';
import { isAdminRole } from '../utils/userRole';
import type { AuthUser } from '../types/auth';

export function isAdminAuthUser(user: { role?: string | null } | null | undefined): boolean {
  return isAdminRole(user?.role);
}

/** Live session (foreground bridge). */
export function shouldReceivePushForAuthUser(
  user: AuthUser | null | undefined
): boolean {
  return isAdminAuthUser(user);
}

/** Persisted session (background / quit). */
export async function shouldReceivePushFromPersistedAuth(): Promise<boolean> {
  try {
    const slice = await getPersistedSlice('auth');
    const user = slice?.user as AuthUser | null | undefined;
    return isAdminAuthUser(user);
  } catch {
    return false;
  }
}
