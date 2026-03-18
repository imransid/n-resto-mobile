/**
 * Network reachability. Used to skip API calls when offline.
 */
import NetInfo from '@react-native-community/netinfo';

/**
 * Returns true if the system considers the internet reachable (connected and
 * isInternetReachable is not false). Resolves with false on error or when offline.
 * On first load NetInfo can return null for isInternetReachable — we treat that as reachable
 * and allow one retry after a short delay if the first result was false.
 */
export async function isInternetReachable(): Promise<boolean> {
  const check = async (): Promise<boolean> => {
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return false;
      if (state.isInternetReachable === false) return false;
      return true;
    } catch {
      return false;
    }
  };

  const first = await check();
  if (first) return true;
  await new Promise((r) => setTimeout(r, 1500));
  return check();
}
