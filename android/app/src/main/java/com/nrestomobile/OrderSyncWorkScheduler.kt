package com.nrestomobile

import android.content.Context
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import java.util.concurrent.TimeUnit

/**
 * Only enqueue work when JS enables sync ([setEnabled]); avoids waking RN headless every 15 min when unused.
 * Periodic work persists across reboots once scheduled (no BOOT_COMPLETED receiver needed).
 */
object OrderSyncWorkScheduler {

  private const val UNIQUE_PERIODIC = "nresto_order_sync_periodic"
  private const val UNIQUE_DELAYED = "nresto_order_sync_delayed_once"

  private fun networkConstraints(): Constraints =
    Constraints.Builder()
      .setRequiredNetworkType(NetworkType.CONNECTED)
      .build()

  fun ensurePeriodicScheduled(context: Context) {
    val work = PeriodicWorkRequestBuilder<OrderSyncWorker>(15, TimeUnit.MINUTES)
      .setConstraints(networkConstraints())
      .setInputData(workDataOf(OrderSyncWorker.KEY_REASON to "periodic"))
      .build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      UNIQUE_PERIODIC,
      ExistingPeriodicWorkPolicy.KEEP,
      work,
    )
    Log.i(TAG, "enqueueUniquePeriodicWork 15min interval")
  }

  /** Optional one-shot after enabling sync (avoids waiting up to 15 min for first tick). */
  fun scheduleDelayedOnce(context: Context, delaySeconds: Long, reason: String) {
    val work = OneTimeWorkRequestBuilder<OrderSyncWorker>()
      .setConstraints(networkConstraints())
      .setInitialDelay(delaySeconds.coerceAtLeast(15), TimeUnit.SECONDS)
      .setInputData(workDataOf(OrderSyncWorker.KEY_REASON to reason))
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.MINUTES)
      .build()

    WorkManager.getInstance(context).enqueueUniqueWork(
      UNIQUE_DELAYED,
      ExistingWorkPolicy.REPLACE,
      work,
    )
    Log.i(TAG, "enqueueUniqueWork delayed ${delaySeconds.coerceAtLeast(15)}s reason=$reason")
  }

  fun cancelAll(context: Context) {
    val wm = WorkManager.getInstance(context)
    wm.cancelUniqueWork(UNIQUE_PERIODIC)
    wm.cancelUniqueWork(UNIQUE_DELAYED)
    Log.i(TAG, "cancelAll")
  }

  private const val TAG = "OrderSyncWorkScheduler"
}
