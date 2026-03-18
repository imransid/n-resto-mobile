/**
 * Auth persistence — single place for reading/writing auth.
 * Use this for login, logout, and hydration. AppContext subscribes to DB and calls these.
 *
 * Production: store accessToken in react-native-keychain and keep user in KeyValue,
 * or use Keychain for both; then implement getStoredAuth/setStoredAuth/clearStoredAuth
 * with Keychain + fallback.
 */
import { getPersistedSlice, setPersistedSlice } from '../database';
import type { AuthState, StoredAuthPayload } from '../types/auth';
import { INITIAL_AUTH } from '../types/auth';
import type { DemoUser } from '../constants/demoData';

const AUTH_KEY = 'auth';

function parseStoredAuth(raw: Record<string, unknown> | null): AuthState {
  if (!raw || typeof raw !== 'object') return INITIAL_AUTH;
  const user = raw.user as DemoUser | null | undefined;
  const validUser =
    user &&
    typeof user === 'object' &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    typeof user.name === 'string';
  return {
    user: validUser ? user : null,
    accessToken: typeof raw.accessToken === 'string' ? raw.accessToken : null,
    isAuthenticated: raw.isAuthenticated === true,
  };
}

/** Read persisted auth (e.g. on app load or when DB subscription fires). */
export async function getStoredAuth(): Promise<AuthState> {
  const raw = await getPersistedSlice(AUTH_KEY);
  return parseStoredAuth(raw);
}

/** Persist auth after login. */
export async function setStoredAuth(payload: StoredAuthPayload): Promise<void> {
  await setPersistedSlice(AUTH_KEY, payload as unknown as Record<string, unknown>);
}

/** Clear auth on logout. */
export async function clearStoredAuth(): Promise<void> {
  await setStoredAuth({
    user: null,
    accessToken: null,
    isAuthenticated: false,
  });
}

/** Parse raw record (e.g. from KeyValue observer) into AuthState. */
export function parseAuth(raw: Record<string, unknown> | null): AuthState {
  return parseStoredAuth(raw);
}
