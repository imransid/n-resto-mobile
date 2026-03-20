package com.nrestomobile

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Promise

/**
 * Lightweight connectivity monitor on a dedicated [HandlerThread]. Does not perform I/O or sync —
 * only emits events so JS can run WatermelonDB + HTTP off the UI path.
 */
class OrderSyncMonitorModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "OrderSyncMonitor"

  private var worker: HandlerThread? = null
  private var workerHandler: Handler? = null
  private var connectivityManager: ConnectivityManager? = null
  private var callback: ConnectivityManager.NetworkCallback? = null
  private var lastOnline: Boolean? = null
  private var monitoring = false

  @ReactMethod
  fun startMonitoring() {
    if (monitoring) return
    monitoring = true
    val cm = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
      ?: return
    connectivityManager = cm

    val thread = HandlerThread("OrderSyncMonitor").apply { start() }
    worker = thread
    workerHandler = Handler(thread.looper)

    val cb = object : ConnectivityManager.NetworkCallback() {
      override fun onCapabilitiesChanged(network: Network, caps: NetworkCapabilities) {
        val online = caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
          caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        maybeEmit(online)
      }

      override fun onLost(network: Network) {
        maybeEmit(false)
      }
    }
    callback = cb

    workerHandler?.post {
      try {
        val request = NetworkRequest.Builder()
          .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
          .build()
        cm.registerNetworkCallback(request, cb)
        val active = cm.activeNetwork
        val caps = active?.let { cm.getNetworkCapabilities(it) }
        val online = caps != null &&
          caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
          caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
        maybeEmit(online)
      } catch (e: Exception) {
        Log.e(TAG, "startMonitoring", e)
      }
    }
  }

  @ReactMethod
  fun stopMonitoring() {
    if (!monitoring) return
    monitoring = false
    val cm = connectivityManager
    val cb = callback
    callback = null
    connectivityManager = null
    workerHandler?.post {
      try {
        if (cm != null && cb != null) cm.unregisterNetworkCallback(cb)
      } catch (e: Exception) {
        Log.w(TAG, "unregisterNetworkCallback", e)
      }
    }
    worker?.quitSafely()
    worker = null
    workerHandler = null
    lastOnline = null
  }

  /**
   * Enable/disable WorkManager jobs. When disabled, no periodic headless runs (saves battery/CPU).
   * Call from JS when `ordersSyncUrl` is set or cleared.
   */
  @ReactMethod
  fun setBackgroundWorkEnabled(enabled: Boolean, promise: Promise) {
    try {
      val app = reactApplicationContext.applicationContext
      if (enabled) {
        Log.i(TAG, "setBackgroundWorkEnabled true: scheduling periodic + delayed WorkManager")
        OrderSyncWorkScheduler.ensurePeriodicScheduled(app)
        OrderSyncWorkScheduler.scheduleDelayedOnce(app, 120L, "enable_catchup")
      } else {
        Log.i(TAG, "setBackgroundWorkEnabled false: cancel WorkManager")
        OrderSyncWorkScheduler.cancelAll(app)
      }
      promise.resolve(null)
    } catch (e: Exception) {
      Log.e(TAG, "setBackgroundWorkEnabled", e)
      promise.reject("ORDER_SYNC_WORK", e.message, e)
    }
  }

  private fun maybeEmit(online: Boolean) {
    if (lastOnline == online) return
    lastOnline = online
    val params = Arguments.createMap().apply { putBoolean("online", online) }
    reactApplicationContext.runOnUiQueueThread {
      try {
        reactApplicationContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit(EVENT_NAME, params)
      } catch (e: Exception) {
        Log.w(TAG, "emit", e)
      }
    }
  }

  companion object {
    private const val TAG = "OrderSyncMonitor"
    const val EVENT_NAME: String = "OrderSyncMonitorConnectivity"
  }
}
