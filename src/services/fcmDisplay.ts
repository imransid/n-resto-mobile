import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import {
  ADMIN_ORDERS_CHANNEL_ID,
  ensureAdminOrderNotificationChannel,
} from './adminLocalNotifications';
import { shouldReceivePushFromPersistedAuth } from './fcmAdminGate';

function displayPartsFromRemote(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage
): { title: string; body: string } | null {
  const n = remoteMessage.notification;
  if (n?.title != null || n?.body != null) {
    return {
      title: (n.title ?? 'nResto').trim() || 'nResto',
      body: (n.body ?? '').trim(),
    };
  }
  const d = remoteMessage.data;
  if (d && (d.title != null || d.body != null)) {
    return {
      title: String(d.title ?? 'nResto').trim() || 'nResto',
      body: String(d.body ?? '').trim(),
    };
  }
  return null;
}

/**
 * Foreground: FCM does not show a tray notification — mirror with Notifee.
 */
export async function displayFcmForeground(remoteMessage: FirebaseMessagingTypes.RemoteMessage): Promise<void> {
  /** Role gate lives in FcmNotificationBridge (live session). */
  const parts = displayPartsFromRemote(remoteMessage);
  if (!parts) return;
  await ensureAdminOrderNotificationChannel();
  await notifee.displayNotification({
    title: parts.title,
    body: parts.body,
    data: remoteMessage.data ? { ...remoteMessage.data } : undefined,
    android: {
      channelId: ADMIN_ORDERS_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
}

/**
 * Background quit/headless: only for **data-only** high-priority messages.
 * Notification payloads are already shown by the OS / FCM.
 */
export async function displayFcmBackgroundDataOnly(
  remoteMessage: FirebaseMessagingTypes.RemoteMessage
): Promise<void> {
  if (remoteMessage.notification) return;
  if (!(await shouldReceivePushFromPersistedAuth())) return;
  const parts = displayPartsFromRemote(remoteMessage);
  if (!parts) return;
  await ensureAdminOrderNotificationChannel();
  await notifee.displayNotification({
    title: parts.title,
    body: parts.body,
    data: remoteMessage.data ? { ...remoteMessage.data } : undefined,
    android: {
      channelId: ADMIN_ORDERS_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
}
