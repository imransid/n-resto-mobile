/**
 * Auth only — does not subscribe to POS cart / orders (see `AuthContext`).
 * For cart, orders, and POS session use `useApp()`.
 */
import { useAuthContext } from '../context/AuthContext';

export function useAuth() {
  return useAuthContext();
}
