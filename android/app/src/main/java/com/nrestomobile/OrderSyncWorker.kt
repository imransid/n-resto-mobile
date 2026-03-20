package com.nrestomobile

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Runs on WorkManager's thread pool; delegates to [OrderSyncHeadlessService] so WatermelonDB stays in JS.
 */
class OrderSyncWorker(
  appContext: Context,
  params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

  override suspend fun doWork(): Result = withContext(Dispatchers.Default) {
    try {
      val reason = inputData.getString(KEY_REASON) ?: "workmanager"
      Log.i(TAG, "doWork starting headless reason=$reason")
      OrderSyncHeadlessService.start(applicationContext, reason)
      Log.i(TAG, "doWork OrderSyncHeadlessService.start returned")
      Result.success()
    } catch (e: Exception) {
      Log.e(TAG, "doWork", e)
      Result.retry()
    }
  }

  companion object {
    private const val TAG = "OrderSyncWorker"
    const val KEY_REASON = "reason"
  }
}
