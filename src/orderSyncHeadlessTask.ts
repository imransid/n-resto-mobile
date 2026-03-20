/**
 * Invoked from Android HeadlessJsTaskService (WorkManager / boot) when the UI may not be mounted.
 * Must stay independent of React context / hooks.
 */
import { runOrderUploadAndClear } from './services/orderBackgroundSyncService';

export default async function orderSyncHeadlessTask(
  data?: { reason?: string } | null
): Promise<void> {
  const reason = data?.reason ?? 'headless';
  console.log('[OrderSync] headless JS task invoked', { reason });
  await runOrderUploadAndClear(reason, { bypassThrottle: true });
}
