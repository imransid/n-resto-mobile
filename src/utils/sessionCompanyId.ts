import type { AuthState } from '../types/auth';
import { storeConfig } from '../constants/storeConfig';

/** Resolved tenant id for orders / dashboard (session company, user, then config fallback). */
export function resolveSessionCompanyId(auth: AuthState): string {
  const fromSession = auth.company?.id?.trim();
  if (fromSession) return fromSession;
  const fromUser = auth.user?.companyId?.trim();
  if (fromUser) return fromUser;
  return (storeConfig.masterDataCompanyId ?? '').trim();
}
