/**
 * Normalizes API/demo role strings for routing and admin-only features.
 */
export function normalizeRole(role: string | null | undefined): string {
  return (role ?? '').trim().toUpperCase();
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'ADMIN';
}
