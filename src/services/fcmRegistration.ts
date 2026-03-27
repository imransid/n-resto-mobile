import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { AUTH_API_BASE } from '@env';
import type { AuthState } from '../types/auth';
import {
  registerAuthServicePushDevice,
  unregisterAuthServicePushDevice,
} from './authNotificationsApi';
import { getOrCreateDeviceId } from './masterDataService';
import { shouldReceivePushForAuthUser } from './fcmAdminGate';

async function ensureAndroidPostNotifications(): Promise<boolean> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function registerTokenWithAuthService(token: string, auth: AuthState): Promise<void> {
  const base = AUTH_API_BASE?.trim();
  const userId = auth.user?.id?.trim();
  const accessToken = auth.accessToken?.trim();
  if (!base || !userId || !accessToken || !auth.isAuthenticated) return;

  let deviceId: string | undefined;
  try {
    deviceId = await getOrCreateDeviceId();
  } catch {
    // optional field
  }

  await registerAuthServicePushDevice(base, userId, token, {
    accessToken,
    platform: Platform.OS,
    deviceId,
  });
}

export async function registerDeviceForFcm(auth: AuthState): Promise<string | null> {
  if (!auth.isAuthenticated || !shouldReceivePushForAuthUser(auth.user)) return null;

  await ensureAndroidPostNotifications();

  if (Platform.OS === 'ios') {
    const status = await messaging().requestPermission();
    const ok =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
    if (!ok) return null;
  }

  const token = await messaging().getToken();
  if (token) {
    try {
      await registerTokenWithAuthService(token, auth);
    } catch (e) {
      if (__DEV__) console.warn('[FCM] auth-service device register failed', e);
    }
  }
  return token;
}

export function subscribeFcmForeground(
  onRemote: (m: FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    onRemote(remoteMessage);
  });
}

export function subscribeFcmTokenRefresh(getAuth: () => AuthState): () => void {
  return messaging().onTokenRefresh(async (newToken) => {
    const auth = getAuth();
    if (!shouldReceivePushForAuthUser(auth.user)) return;
    try {
      await registerTokenWithAuthService(newToken, auth);
    } catch (e) {
      if (__DEV__) console.warn('[FCM] auth-service token refresh register failed', e);
    }
  });
}

/**
 * Unregisters from auth-service (when configured) then invalidates the local FCM token.
 * Pass the session that was active for this device registration (e.g. from a ref during logout cleanup).
 */
export async function unregisterFcmDevice(auth?: AuthState | null): Promise<void> {
  const base = AUTH_API_BASE?.trim();
  const accessToken = auth?.accessToken?.trim();
  if (base && accessToken) {
    try {
      const fcmToken = await messaging().getToken();
      if (fcmToken) {
        await unregisterAuthServicePushDevice(base, fcmToken, accessToken);
      }
    } catch (e) {
      if (__DEV__) console.warn('[FCM] auth-service device unregister failed', e);
    }
  }
  try {
    await messaging().deleteToken();
  } catch {
    // ignore
  }
}
