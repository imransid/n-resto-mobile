import {
  DeviceEventEmitter,
  NativeEventEmitter,
  NativeModules,
  Platform,
} from 'react-native';

const EVENT = 'OrderSyncMonitorConnectivity';

type NativeMod = {
  startMonitoring?: () => void;
  stopMonitoring?: () => void;
  setBackgroundWorkEnabled?: (enabled: boolean) => Promise<void>;
};

const OrderSyncMonitor = NativeModules.OrderSyncMonitor as NativeMod | undefined;

/** Android only: register/cancel WorkManager (no-op when sync URL empty — saves battery). */
export function setAndroidBackgroundWorkEnabled(enabled: boolean): void {
  if (Platform.OS !== 'android' || !OrderSyncMonitor?.setBackgroundWorkEnabled) return;
  OrderSyncMonitor.setBackgroundWorkEnabled(enabled).catch(() => {
    /* native reject — ignore */
  });
}

/**
 * Subscribe to OS-level connectivity (native background thread / queue). Android starts
 * `HandlerThread` + `NetworkCallback`; iOS uses `NWPathMonitor` on a serial queue.
 */
export function subscribeToConnectivity(onOnlineChange: (online: boolean) => void): () => void {
  if (!OrderSyncMonitor) {
    if (__DEV__) {
      console.warn('[OrderSyncMonitor] Native module missing — rebuild the app.');
    }
    return () => {};
  }

  const handler = (e: { online?: boolean }) => {
    onOnlineChange(e?.online === true);
  };

  if (Platform.OS === 'android') {
    OrderSyncMonitor.startMonitoring?.();
    const sub = DeviceEventEmitter.addListener(EVENT, handler);
    return () => {
      sub.remove();
      OrderSyncMonitor.stopMonitoring?.();
    };
  }

  const emitter = new NativeEventEmitter(OrderSyncMonitor as object);
  const sub = emitter.addListener(EVENT, handler);
  return () => sub.remove();
}
