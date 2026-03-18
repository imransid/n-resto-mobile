/**
 * Auth hook — use when you only need auth state and actions.
 * For full app context (cart, orders, etc.) use useApp().
 */
import { useApp } from '../context/AppContext';

export function useAuth() {
  const { auth, login, logout } = useApp();
  return { ...auth, login, logout };
}
