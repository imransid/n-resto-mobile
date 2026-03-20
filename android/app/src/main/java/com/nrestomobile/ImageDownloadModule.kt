package com.nrestomobile

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Downloads images on a dedicated background thread into the app's Document (files) path.
 * Uses context.getFilesDir()/NRestoMobile. JS passes list of { imageUrl, itemId };
 * native downloads each to Documents/NRestoMobile/itemId.ext and returns [{ itemId, localPath }].
 */
class ImageDownloadModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ImageDownload"

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()

  companion object {
    private const val TAG = "ImageDownload"
    private const val SUBFOLDER = "NRestoMobile"
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val READ_TIMEOUT_MS = 20_000
  }

  /** App's Document (files) directory + NRestoMobile subfolder. */
  private fun getDocumentsImageDir(): File {
    val filesDir = reactApplicationContext.filesDir
    val dir = File(filesDir, SUBFOLDER)
    if (!dir.exists()) dir.mkdirs()
    return dir
  }

  @ReactMethod
  fun downloadImages(items: ReadableArray, imagesDir: String?, authorization: String?, promise: Promise) {
    executor.execute {
      try {
        val dir = if (!imagesDir.isNullOrBlank()) {
          val f = File(imagesDir)
          if (!f.exists()) f.mkdirs()
          f
        } else {
          getDocumentsImageDir()
        }
        val authHeader = authorization?.trim()?.takeIf { it.isNotEmpty() }
        val results = Arguments.createArray()
        for (i in 0 until items.size()) {
          val item = items.getMap(i) ?: continue
          val imageUrl = item.getString("imageUrl") ?: continue
          val itemId = item.getString("itemId") ?: continue
          val localPath = downloadOne(imageUrl, itemId, dir, authHeader)
          if (localPath != null) {
            val map = Arguments.createMap()
            map.putString("itemId", itemId)
            map.putString("localPath", localPath)
            results.pushMap(map)
          }
        }
        promise.resolve(results)
      } catch (e: Exception) {
        Log.e(TAG, "downloadImages error", e)
        promise.reject("DOWNLOAD_ERROR", e.message)
      }
    }
  }

  private fun getExtension(url: String): String {
    val match = Regex("\\.([a-zA-Z0-9]+)(?:\\?|$)").find(url)
    return if (match != null) ".${match.groupValues[1].lowercase()}" else ".jpg"
  }

  private fun downloadOne(imageUrl: String, itemId: String, dir: File, authorization: String?): String? {
    var connection: HttpURLConnection? = null
    try {
      val url = URL(imageUrl)
      connection = url.openConnection() as HttpURLConnection
      connection.connectTimeout = CONNECT_TIMEOUT_MS
      connection.readTimeout = READ_TIMEOUT_MS
      connection.requestMethod = "GET"
      connection.instanceFollowRedirects = true
      connection.setRequestProperty("User-Agent", "NRestoMobile/1.0")
      if (!authorization.isNullOrBlank()) {
        connection.setRequestProperty("Authorization", authorization)
      }
      val code = connection.responseCode
      if (code != HttpURLConnection.HTTP_OK) {
        Log.w(TAG, "downloadOne HTTP $code for $imageUrl")
        return null
      }
      val ext = getExtension(imageUrl)
      val safeId = itemId.replace(Regex("[^a-zA-Z0-9_-]"), "_")
      val file = File(dir, "$safeId$ext")
      connection.inputStream.use { input ->
        file.outputStream().use { output ->
          input.copyTo(output)
        }
      }
      return file.absolutePath
    } catch (e: Exception) {
      Log.w(TAG, "downloadOne failed: $imageUrl", e)
      return null
    } finally {
      connection?.disconnect()
    }
  }

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }
}
