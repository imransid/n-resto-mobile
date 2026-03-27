import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { shouldReceivePushForAuthUser } from '../services/fcmAdminGate';
import { displayFcmForeground } from '../services/fcmDisplay';
import {
  registerDeviceForFcm,
  subscribeFcmForeground,
  subscribeFcmTokenRefresh,
  unregisterFcmDevice,
} from '../services/fcmRegistration';

/**
 * ADMIN only: registers FCM with auth-service and shows foreground pushes.
 * Staff sessions: unregisters device + deletes token so this device is not targeted.
 * On teardown/logout: `DELETE /notifications/devices` then `deleteToken()`.
 */
export default function FcmNotificationBridge() {
  const { auth, authHydrated } = useAuth();
  const authSnapRef = useRef(auth);

  useEffect(() => {
    authSnapRef.current = auth;
  }, [auth]);

  useEffect(() => {
    if (!authHydrated || !auth.isAuthenticated) {
      return;
    }

    if (!shouldReceivePushForAuthUser(auth.user)) {
      unregisterFcmDevice(auth).catch(() => undefined);
      return;
    }

    let releaseForeground: (() => void) | undefined;
    let releaseRefresh: (() => void) | undefined;

    const run = async () => {
      await registerDeviceForFcm(authSnapRef.current);
      releaseForeground = subscribeFcmForeground((remoteMessage) => {
        if (!shouldReceivePushForAuthUser(authSnapRef.current.user)) return;
        displayFcmForeground(remoteMessage).catch(() => undefined);
      });
      releaseRefresh = subscribeFcmTokenRefresh(() => authSnapRef.current);
    };

    run().catch((e) => {
      if (__DEV__) console.warn('[FCM] setup failed', e);
    });

    return () => {
      releaseForeground?.();
      releaseRefresh?.();
      unregisterFcmDevice(authSnapRef.current).catch(() => undefined);
    };
  }, [authHydrated, auth.isAuthenticated, auth.user?.id, auth.user?.role, auth.accessToken]);

  return null;
}
