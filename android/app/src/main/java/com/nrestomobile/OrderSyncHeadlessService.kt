package com.nrestomobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Runs [OrderSyncHeadless] in a headless JS context. Must call [startForeground] immediately:
 * Android kills the app with [ForegroundServiceDidNotStartInTimeException] if promotion is delayed
 * (e.g. Metro offline, slow RN init) — RN’s base class does not promote early enough.
 */
class OrderSyncHeadlessService : HeadlessJsTaskService() {

  private var foregroundPromoted = false

  override fun onCreate() {
    promoteToForegroundImmediately()
    super.onCreate()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    promoteToForegroundImmediately()
    return super.onStartCommand(intent, flags, startId)
  }

  private fun promoteToForegroundImmediately() {
    if (foregroundPromoted) return
    val nm = getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val ch =
        NotificationChannel(
          CHANNEL_ID,
          "Order sync",
          NotificationManager.IMPORTANCE_LOW,
        ).apply {
          setShowBadge(false)
        }
      nm.createNotificationChannel(ch)
    }
    val notification =
      NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle(getString(R.string.order_sync_notification_title))
        .setContentText(getString(R.string.order_sync_notification_text))
        .setSmallIcon(R.mipmap.ic_launcher)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .build()
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC,
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
      foregroundPromoted = true
    } catch (e: Exception) {
      Log.e(TAG, "startForeground failed", e)
    }
  }

  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig? {
    val reason = intent?.getStringExtra(EXTRA_REASON) ?: REASON_DEFAULT
    Log.i(TAG, "getTaskConfig reason=$reason")
    val data = Arguments.createMap().apply { putString("reason", reason) }
    return HeadlessJsTaskConfig(
      TASK_KEY,
      data,
      TASK_TIMEOUT_MS,
      true,
    )
  }

  companion object {
    private const val TAG = "OrderSyncHeadless"
    const val TASK_KEY = "OrderSyncHeadless"
    private const val EXTRA_REASON = "reason"
    private const val REASON_DEFAULT = "headless"
    private const val CHANNEL_ID = "order_sync_headless"
    private const val NOTIFICATION_ID = 7101
    /** Long enough for slow networks + large payloads */
    private const val TASK_TIMEOUT_MS = 120_000L

    fun start(context: android.content.Context, reason: String) {
      Log.i(TAG, "start foreground service reason=$reason")
      val intent = Intent(context, OrderSyncHeadlessService::class.java).apply {
        putExtra(EXTRA_REASON, reason)
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ContextCompat.startForegroundService(context, intent)
        } else {
          context.startService(intent)
        }
      } catch (e: Exception) {
        Log.e(TAG, "start failed (FGS restrictions or missing permission?)", e)
      }
    }
  }
}
