/**
 * nResto Mobile — BOLT Fusion Tech
 * React Native POS: Login + Point of Sale (WatermelonDB, no Redux)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import RootNavigator from './src/navigation/RootNavigator';
import AdminOrderNotificationBridge from './src/components/AdminOrderNotificationBridge';
import FcmNotificationBridge from './src/components/FcmNotificationBridge';
import { SplashScreen } from './src/components/SplashScreen';
import {
  loadMasterDataOnInit,
  getOrCreateDeviceId,
} from './src/services/masterDataService';
import { getPersistedSlice } from './src/database';
import { seedMasterDataIfEmpty, hasMasterData } from './src/database';
import { storeConfig } from './src/constants/storeConfig';
import { startOrderBackgroundSync } from './src/services/orderBackgroundSyncService';
import { startPaidOrdersCleanup } from './src/services/paidOrdersCleanupService';

/** Defer until after initial paint to avoid blocking first frame. */
function afterInitialFrame(): Promise<void> {
  return new Promise((resolve) =>
    require('react-native').InteractionManager.runAfterInteractions(() =>
      setTimeout(resolve, 0)
    )
  );
}

async function loadMasterDataWithFallback(): Promise<void> {
  await afterInitialFrame();

  let deviceId: string | undefined;
  let userId: string | undefined;
  try {
    deviceId = await getOrCreateDeviceId();
    const auth = await getPersistedSlice('auth');
    userId = (auth?.user as { id?: string } | undefined)?.id;
  } catch (e) {
    if (__DEV__) console.warn('[NResto] deviceId/auth read failed (will still call API)', e);
  }

  // Always call when graphqlApiBase is set — don't skip if deviceId/auth failed
  try {

    await loadMasterDataOnInit({
      deviceId,
      userId,
      description: 'Master data sync',
      companyId: storeConfig.masterDataCompanyId?.trim() || undefined,
    });
  } catch (e) {
    if (__DEV__) console.warn('[NResto] loadMasterDataOnInit failed', e);
  }

  try {
    const hasData = await hasMasterData();
    if (!hasData) {
      await seedMasterDataIfEmpty();
      if (__DEV__) console.log('[NResto] DB seeded with demo data');
    }
  } catch (e) {
    if (__DEV__) console.warn('[NResto] hasMasterData/seed failed', e);
    try {
      await seedMasterDataIfEmpty();
      if (__DEV__) console.log('[NResto] DB seeded (fallback)');
    } catch (e2) {
      if (__DEV__) console.warn('[NResto] seedMasterDataIfEmpty failed', e2);
    }
  }
}

export default function App() {
  const [showApp, setShowApp] = useState(false);
  const onSplashFinish = useCallback(() => setShowApp(true), []);

  /** Defer sync + cleanup until after app is visible to keep startup fast. */
  useEffect(() => {
    if (!showApp) return;
    const unsubSync = startOrderBackgroundSync();
    const unsubCleanup = startPaidOrdersCleanup();
    return () => {
      unsubSync();
      unsubCleanup();
    };
  }, [showApp]);

  const masterDataPromise = useMemo(() => {
    if (storeConfig.graphqlApiBase?.trim()) {
      return loadMasterDataWithFallback();
    }
    return (async () => {
      await afterInitialFrame();
      try {
        const hasData = await hasMasterData();
        if (!hasData) {
          await seedMasterDataIfEmpty();
          if (__DEV__) console.log('[NResto] DB seeded (no API config)');
        }
      } catch (e) {
        if (__DEV__) console.warn('[NResto] seed failed', e);
        try {
          await seedMasterDataIfEmpty();
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      {!showApp ? (
        <SplashScreen onFinish={onSplashFinish} masterDataPromise={masterDataPromise} />
      ) : (
        <AuthProvider>
          <AppProvider>
            <AdminOrderNotificationBridge />
            <FcmNotificationBridge />
            <SafeAreaProvider>
              <RootNavigator />
            </SafeAreaProvider>
          </AppProvider>
        </AuthProvider>
      )}
    </View>
  );
}
