import { useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { displayFcmForeground } from '../services/fcmDisplay';
import {
  registerDeviceForFcm,
  subscribeFcmForeground,
  subscribeFcmTokenRefresh,
  unregisterFcmDevice,
} from '../services/fcmRegistration';

/**
 * After login: registers the FCM token with auth-service
 * `POST /notifications/users/:userId/devices` when `AUTH_API_BASE` is set.
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

    let releaseForeground: (() => void) | undefined;
    let releaseRefresh: (() => void) | undefined;

    const run = async () => {
      await registerDeviceForFcm(authSnapRef.current);
      releaseForeground = subscribeFcmForeground((remoteMessage) => {
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
  }, [authHydrated, auth.isAuthenticated, auth.user?.id]);

  return null;
}
