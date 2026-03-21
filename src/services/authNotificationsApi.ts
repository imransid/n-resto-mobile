import { Platform } from 'react-native';

function normalizeAuthBase(base: string): string {
  const trimmed = base.replace(/\/+$/, '');
  if (Platform.OS === 'android' && (trimmed.includes('localhost') || trimmed.includes('127.0.0.1'))) {
    return trimmed.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }
  return trimmed;
}

function bearerHeaders(accessToken: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };
}

/**
 * POST `/notifications/users/:userId/devices` — auth-service (see push integration guide).
 */
export async function registerAuthServicePushDevice(
  authBaseRaw: string,
  userId: string,
  fcmToken: string,
  opts: { accessToken: string; platform?: string; deviceId?: string }
): Promise<void> {
  const authBase = normalizeAuthBase(authBaseRaw.trim());
  const url = `${authBase}/notifications/users/${encodeURIComponent(userId)}/devices`;
  const res = await fetch(url, {
    method: 'POST',
    headers: bearerHeaders(opts.accessToken.trim()),
    body: JSON.stringify({
      fcmToken,
      platform: opts.platform,
      deviceId: opts.deviceId,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`registerAuthServicePushDevice failed: ${res.status} ${text}`);
  }
}

/**
 * DELETE `/notifications/devices` — 204 success; 404 if token unknown (treated as OK).
 */
export async function unregisterAuthServicePushDevice(
  authBaseRaw: string,
  fcmToken: string,
  accessToken: string
): Promise<void> {
  const authBase = normalizeAuthBase(authBaseRaw.trim());
  const url = `${authBase}/notifications/devices`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: bearerHeaders(accessToken.trim()),
    body: JSON.stringify({ fcmToken }),
  });
  if (res.status === 404) return;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`unregisterAuthServicePushDevice failed: ${res.status} ${text}`);
  }
}
