import notifee, { AndroidImportance, AuthorizationStatus } from '@notifee/react-native';
import { Platform, PermissionsAndroid } from 'react-native';

/** Shared with FCM foreground/background display (Notifee). */
export const ADMIN_ORDERS_CHANNEL_ID = 'nresto-admin-orders';

export async function ensureAdminOrderNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await notifee.createChannel({
    id: ADMIN_ORDERS_CHANNEL_ID,
    name: 'Staff orders',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
  });
}

export async function requestAdminNotificationPermission(): Promise<boolean> {
  await ensureAdminOrderNotificationChannel();
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      return false;
    }
  }
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
}

export async function showAdminNewStaffOrderNotification(params: {
  orderId: string;
  total: number;
  customerName?: string;
}): Promise<void> {
  const who = params.customerName?.trim();
  const body = `${who ? `${who} · ` : ''}$${params.total.toFixed(2)} · ${params.orderId}`;
  await notifee.displayNotification({
    title: 'New order from staff',
    body,
    android: {
      channelId: ADMIN_ORDERS_CHANNEL_ID,
      pressAction: { id: 'default' },
    },
    ios: { sound: 'default' },
  });
}
