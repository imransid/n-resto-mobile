import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Q } from '@nozbe/watermelondb';
import { database } from '../database/databaseInstance';
import { getPersistedSlice } from '../database';
import type KeyValue from '../database/KeyValue';
import type { DemoUser } from '../constants/demoData';
import { type AuthState, INITIAL_AUTH } from '../types/auth';
import { parseAuth, setStoredAuth, clearStoredAuth } from '../services/authService';

export type { AuthState };

interface AuthContextValue {
  auth: AuthState;
  authHydrated: boolean;
  login: (user: DemoUser, accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth only — separate from POS/orders so Login and tab shell do not re-render on every cart tick.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(INITIAL_AUTH);
  const [authHydrated, setAuthHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const authRaw = await getPersistedSlice('auth');
        if (!cancelled) setAuth(parseAuth(authRaw));
      } catch {
        // ignore
      } finally {
        if (!cancelled) setAuthHydrated(true);
      }
    })();

    try {
      const kv = database.get<KeyValue>('key_value');
      const sub = kv.query(Q.where('key', 'auth')).observe().subscribe((records) => {
        const r = records[0];
        const raw = r?.value != null ? (JSON.parse(r.value) as Record<string, unknown>) : null;
        setAuth(parseAuth(raw));
      });
      return () => {
        cancelled = true;
        sub.unsubscribe();
      };
    } catch (err) {
      if (__DEV__) console.warn('AuthContext: database not ready', err);
      setAuthHydrated(true);
      return () => {
        cancelled = true;
      };
    }
  }, []);

  const login = useCallback(async (user: DemoUser, accessToken: string) => {
    await setStoredAuth({ user, accessToken, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await clearStoredAuth();
  }, []);

  const value = useMemo(
    () => ({ auth, authHydrated, login, logout }),
    [auth, authHydrated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
