/**
 * Auth persistence — KeyValue holds full session (user, company, tokens).
 * Optional DB sync: `users` row + single `companies` row in one SQLite transaction.
 */
import { Q } from '@nozbe/watermelondb';

import { getPersistedSlice, setPersistedSlice } from '../database';
import { database } from '../database/databaseInstance';
import type KeyValue from '../database/KeyValue';
import type User from '../database/User';
import type Company from '../database/Company';
import type { AuthState, AuthUser, SessionCompany, StoredAuthPayload } from '../types/auth';
import { INITIAL_AUTH } from '../types/auth';
import { storeConfig } from '../constants/storeConfig';
import { postLogin, LoginApiError } from './loginApi';

const AUTH_KEY = 'auth';

export { LoginApiError };

export interface UserRowSync {
  user_id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string | null;
  company_id: string | null;
  avatar_url: string | null;
  profile_extra: string | null;
}

export interface CompanyRowSync {
  company_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  profile_extra: string | null;
}

/**
 * When `db` is omitted, only KeyValue is updated.
 * `companySync`: `undefined` = leave `companies` table unchanged; `null` = delete all rows; value = replace table with one row.
 */
export interface SetStoredAuthDbOptions {
  userRow?: UserRowSync;
  companySync?: null | CompanyRowSync;
}

/** Build SQLite `users` row fields from session user (demo or API). */
export function userRowSyncFromAuthUser(
  user: AuthUser,
  profileExtraJson: string | null = null
): UserRowSync {
  return authUserToRowSync(user, profileExtraJson);
}

export function companyRowSyncFromSession(
  company: SessionCompany,
  profileExtraJson: string | null = null
): CompanyRowSync {
  const pe = (profileExtraJson ?? '').trim();
  return {
    company_id: company.id,
    name: company.name,
    address: company.address != null && String(company.address).trim() ? String(company.address).trim() : null,
    phone: company.phone != null && String(company.phone).trim() ? String(company.phone).trim() : null,
    email: company.email != null && String(company.email).trim() ? String(company.email).trim() : null,
    website: company.website != null && String(company.website).trim() ? String(company.website).trim() : null,
    logo: company.logo != null && String(company.logo).trim() ? String(company.logo).trim() : null,
    profile_extra: pe || null,
  };
}

function authUserToRowSync(user: AuthUser, profileExtraJson: string | null): UserRowSync {
  const pe = (profileExtraJson ?? '').trim();
  return {
    user_id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone != null && String(user.phone).trim() ? String(user.phone).trim() : null,
    role: user.role != null && String(user.role).trim() ? String(user.role).trim() : null,
    company_id:
      user.companyId != null && String(user.companyId).trim() ? String(user.companyId).trim() : null,
    avatar_url:
      user.avatarUrl != null && String(user.avatarUrl).trim() ? String(user.avatarUrl).trim() : null,
    profile_extra: pe || null,
  };
}

function parseSessionCompany(raw: unknown): SessionCompany | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id.trim() : '';
  const name = typeof o.name === 'string' ? o.name.trim() : '';
  if (!id || !name) return null;
  const s = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t ? t : null;
  };
  return {
    id,
    name,
    address: s(o.address),
    phone: s(o.phone),
    email: s(o.email),
    website: s(o.website),
    logo: s(o.logo),
  };
}

function parseStoredAuth(raw: Record<string, unknown> | null): AuthState {
  if (!raw || typeof raw !== 'object') return INITIAL_AUTH;
  const user = raw.user as AuthUser | null | undefined;
  const validUser =
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string';
  return {
    user: validUser ? user : null,
    accessToken: typeof raw.accessToken === 'string' ? raw.accessToken : null,
    refreshToken: typeof raw.refreshToken === 'string' ? raw.refreshToken : null,
    accessTokenExpiresAt:
      typeof raw.accessTokenExpiresAt === 'string' ? raw.accessTokenExpiresAt : null,
    company: parseSessionCompany(raw.company),
    isAuthenticated: raw.isAuthenticated === true,
  };
}

/** Read persisted auth (e.g. on app load or when DB subscription fires). */
export async function getStoredAuth(): Promise<AuthState> {
  const raw = await getPersistedSlice(AUTH_KEY);
  return parseStoredAuth(raw);
}

async function upsertAuthKeyValueInWriter(
  collection: ReturnType<typeof database.get<KeyValue>>,
  payload: StoredAuthPayload
): Promise<void> {
  const valueStr = JSON.stringify(payload);
  const rows = await collection.query(Q.where('key', AUTH_KEY)).fetch();
  const record = rows[0];
  if (record) {
    await record.update((r) => {
      r.value = valueStr;
    });
  } else {
    await collection.create((r) => {
      r.key = AUTH_KEY;
      r.value = valueStr;
    });
  }
}

async function upsertUserRowInWriter(
  usersCol: ReturnType<typeof database.get<User>>,
  row: UserRowSync
): Promise<void> {
  const byId = await usersCol.query(Q.where('user_id', row.user_id)).fetch();
  const byEmail =
    byId[0] != null
      ? []
      : await usersCol.query(Q.where('email', row.email)).fetch();
  const match = byId[0] ?? byEmail[0];
  if (match) {
    await match.update((u) => {
      u.user_id = row.user_id;
      u.email = row.email;
      u.name = row.name;
      u.phone = row.phone;
      u.role = row.role;
      u.company_id = row.company_id;
      u.avatar_url = row.avatar_url;
      u.profile_extra = row.profile_extra;
    });
  } else {
    await usersCol.create((u) => {
      u.user_id = row.user_id;
      u.email = row.email;
      u.name = row.name;
      u.phone = row.phone;
      u.role = row.role;
      u.company_id = row.company_id;
      u.avatar_url = row.avatar_url;
      u.profile_extra = row.profile_extra;
    });
  }
}

async function wipeCompaniesInWriter(
  companiesCol: ReturnType<typeof database.get<Company>>
): Promise<void> {
  const all = await companiesCol.query().fetch();
  for (const row of all) {
    await row.destroyPermanently();
  }
}

async function replaceCompaniesWithInWriter(
  companiesCol: ReturnType<typeof database.get<Company>>,
  row: CompanyRowSync
): Promise<void> {
  await wipeCompaniesInWriter(companiesCol);
  await companiesCol.create((c) => {
    c.company_id = row.company_id;
    c.name = row.name;
    c.address = row.address;
    c.phone = row.phone;
    c.email = row.email;
    c.website = row.website;
    c.logo = row.logo;
    c.profile_extra = row.profile_extra;
  });
}

/**
 * Persist auth. Pass `db` to run KeyValue + optional `users` / `companies` updates in one transaction.
 */
export async function setStoredAuth(
  payload: StoredAuthPayload,
  db?: SetStoredAuthDbOptions | null
): Promise<void> {
  if (db == null) {
    await setPersistedSlice(AUTH_KEY, payload as unknown as Record<string, unknown>);
    return;
  }

  const kv = database.get<KeyValue>('key_value');
  const usersCol = database.get<User>('users');
  const companiesCol = database.get<Company>('companies');

  await database.write(async () => {
    await upsertAuthKeyValueInWriter(kv, payload);
    if (db.userRow) {
      await upsertUserRowInWriter(usersCol, db.userRow);
    }
    if (db.companySync === null) {
      await wipeCompaniesInWriter(companiesCol);
    } else if (db.companySync !== undefined) {
      await replaceCompaniesWithInWriter(companiesCol, db.companySync);
    }
  });
}

/** Clear auth on logout (KeyValue + wipe `companies`; leaves `users` cache rows). */
export async function clearStoredAuth(): Promise<void> {
  await setStoredAuth(
    {
      user: null,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
      company: null,
      isAuthenticated: false,
    },
    { companySync: null }
  );
}

/** Parse raw record (e.g. from KeyValue observer) into AuthState. */
export function parseAuth(raw: Record<string, unknown> | null): AuthState {
  return parseStoredAuth(raw);
}

/**
 * Real API login when `AUTH_API_BASE` is set in `.env` / storeConfig.
 */
export async function loginWithCredentials(email: string, password: string): Promise<void> {
  const base = (storeConfig.authApiBase ?? '').trim();
  if (!base) {
    throw new LoginApiError('AUTH_API_BASE is not configured');
  }
  const result = await postLogin(base, email, password);
  const userRow = authUserToRowSync(result.authUser, result.profileExtraJson);
  const companySync: null | CompanyRowSync =
    result.company != null
      ? companyRowSyncFromSession(result.company, result.companyExtraJson)
      : null;

  await setStoredAuth(
    {
      user: result.authUser,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      accessTokenExpiresAt: result.accessTokenExpiresAt,
      company: result.company,
      isAuthenticated: true,
    },
    { userRow, companySync }
  );
}
