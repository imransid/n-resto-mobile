/**
 * Auth types — single place for auth state and user shape.
 * Use DemoUser from demoData for demo; replace with API user type when backend is ready.
 */
import type { DemoUser } from '../constants/demoData';

export type User = DemoUser;

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}

export const INITIAL_AUTH: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
};

/** Payload stored in persistence (KeyValue or Keychain). */
export interface StoredAuthPayload {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}
