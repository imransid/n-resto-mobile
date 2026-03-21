/**
 * Auth types — session user, company, and tokens (demo + API login).
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role?: string | null;
  companyId?: string | null;
  avatarUrl?: string | null;
}

/** Tenant from login `data.company`. */
export interface SessionCompany {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  logo?: string | null;
}

export type User = AuthUser;

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  company: SessionCompany | null;
  isAuthenticated: boolean;
}

export const INITIAL_AUTH: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  accessTokenExpiresAt: null,
  company: null,
  isAuthenticated: false,
};

/** Payload stored in persistence (KeyValue or Keychain). */
export interface StoredAuthPayload {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAt: string | null;
  company: SessionCompany | null;
  isAuthenticated: boolean;
}
