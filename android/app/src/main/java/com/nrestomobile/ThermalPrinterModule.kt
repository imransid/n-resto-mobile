package com.nrestomobile

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.util.Log
import com.facebook.react.bridge.*
import java.io.OutputStream
import java.text.DecimalFormat
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Native bridge for thermal printing via Bluetooth ESC/POS.
 * Receives invoice payload from JS, builds ESC/POS bytes, sends to printer.
 */
class ThermalPrinterModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ThermalPrinter"

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()
  private var lastPrinterAddress: String? = null

  companion object {
    private const val TAG = "ThermalPrinter"
    private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private const val WIDTH_CHARS = 32
  }

  @ReactMethod
  fun printInvoice(invoice: ReadableMap, promise: Promise) {
    executor.execute {
      try {
        val address = invoice.getString("printerAddress") ?: lastPrinterAddress
        if (address.isNullOrBlank()) {
          promise.resolve(Arguments.createMap().apply {
            putBoolean("success", false)
            putString("message", "No printer address. Pair a device and set printer target.")
          })
          return@execute
        }
        val bytes = buildEscPosReceipt(invoice)
        sendToBluetooth(address, bytes, promise)
      } catch (e: Exception) {
        Log.e(TAG, "printInvoice error", e)
        promise.resolve(Arguments.createMap().apply {
          putBoolean("success", false)
          putString("message", e.message ?: "Print failed")
        })
      }
    }
  }

  @ReactMethod
  fun setPrinterTarget(config: ReadableMap, promise: Promise) {
    try {
      val type = config.getString("type")
      if (type == "bluetooth") {
        lastPrinterAddress = config.getString("address")
      }
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SET_TARGET_ERROR", e.message)
    }
  }

  @ReactMethod
  fun getAvailablePrinters(promise: Promise) {
    executor.execute {
      try {
        val adapter = BluetoothAdapter.getDefaultAdapter()
        if (adapter == null || !adapter.isEnabled) {
          promise.resolve(Arguments.createArray())
          return@execute
        }
        val paired = adapter.bondedDevices
        val list = Arguments.createArray()
        paired.forEach { device ->
          val item = Arguments.createMap()
          item.putString("name", device.name ?: "Unknown")
          item.putString("address", device.address)
          list.pushMap(item)
        }
        promise.resolve(list)
      } catch (e: Exception) {
        promise.reject("GET_PRINTERS_ERROR", e.message)
      }
    }
  }

  private fun formatNum(n: Double): String =
    DecimalFormat("0.00", java.text.DecimalFormatSymbols(Locale.US)).format(n)

  private fun buildEscPosReceipt(invoice: ReadableMap): ByteArray {
    val out = mutableListOf<Byte>()
    val sep = "-".repeat(WIDTH_CHARS)
    val sepEq = "=".repeat(WIDTH_CHARS)

    fun emit(vararg bytes: Int) = bytes.forEach { out.add(it.toByte()) }
    fun emitStr(s: String) = out.addAll(s.toByteArray(Charsets.UTF_8).toList())
    fun lineFeed() = emit(0x0A)
    fun initPrinter() = emit(0x1B, 0x40)
    fun boldOn() = emit(0x1B, 0x45, 0x01)
    fun boldOff() = emit(0x1B, 0x45, 0x00)
    fun cut() = emit(0x1D, 0x56, 0x00)

    fun center(str: String) {
      val len = str.toByteArray(Charsets.UTF_8).size
      val pad = (WIDTH_CHARS - len).coerceAtLeast(0) / 2
      emitStr(" ".repeat(pad) + str)
      lineFeed()
    }

    fun leftRight(left: String, right: String) {
      val pad = (WIDTH_CHARS - left.length - right.length).coerceAtLeast(1)
      emitStr(left + " ".repeat(pad) + right)
      lineFeed()
    }

    initPrinter()
    lineFeed()

    // Header — Powered By + BOLT Fusion Tech
    center("Powered By")
    val poweredByName = invoice.getString("poweredByName") ?: "BOLT Fusion Tech"
    boldOn()
    center(poweredByName.take(WIDTH_CHARS))
    boldOff()
    lineFeed()

    // Date, company name (storeName), address, etc. (left)
    val storeName = invoice.getString("storeName") ?: "ABC Restaurant"
    invoice.getString("date")?.takeIf { it.isNotBlank() }?.let { emitStr(it); lineFeed() }
    emitStr(storeName.take(WIDTH_CHARS))
    lineFeed()
    invoice.getString("storeAddress")?.takeIf { it.isNotBlank() }?.split("\n")?.forEach { line ->
      if (line.isNotBlank()) { emitStr(line.trim().take(WIDTH_CHARS)); lineFeed() }
    }
    invoice.getString("storePhone")?.takeIf { it.isNotBlank() }?.let { emitStr("Phone $it"); lineFeed() }
    val servedBy = invoice.getString("servedBy") ?: "Admin"
    emitStr("Served by: $servedBy")
    lineFeed()
    invoice.getString("invoiceNumber")?.takeIf { it.isNotBlank() }?.let { emitStr("Order #: $it"); lineFeed() }
    invoice.getString("customerName")?.trim()?.takeIf { it.isNotBlank() }?.let { emitStr("Customer: $it"); lineFeed() }

    // Table / order type + time
    val tableNum = if (invoice.hasKey("tableNumber") && !invoice.isNull("tableNumber")) invoice.getDouble("tableNumber").toInt() else null
    val orderTypeLabel = invoice.getString("orderTypeLabel") ?: "Dine In"
    val orderTime = invoice.getString("orderTime") ?: ""
    if (tableNum != null && tableNum > 0) {
      emitStr(if (orderTime.isNotBlank()) "Table: $tableNum  $orderTime" else "Table: $tableNum")
    } else {
      emitStr(if (orderTime.isNotBlank()) "$orderTypeLabel  $orderTime" else orderTypeLabel)
    }
    lineFeed()
    lineFeed()

    // Items — name left, "qty x price" or "price" right
    val items = invoice.getArray("items")
    if (items != null) {
      for (i in 0 until items.size()) {
        val item = items.getMap(i) ?: continue
        val name = item.getString("name") ?: item.getString("itemCode") ?: "Item"
        val qty = if (item.hasKey("qty")) item.getDouble("qty").toInt() else 1
        val price = if (item.hasKey("unitPrice")) item.getDouble("unitPrice") else item.getDouble("price")
        val lineTotal = if (item.hasKey("lineTotal")) item.getDouble("lineTotal") else price * qty
        val priceStr = formatNum(price)
        val totalStr = formatNum(lineTotal)
        val right = if (qty > 1) "$qty x $priceStr" else totalStr
        leftRight(name.take(WIDTH_CHARS - right.length - 1), right)
      }
    }
    lineFeed()

    // Summary: Subtotal, Service charge, Tax, Total
    val subtotal = if (invoice.hasKey("subtotal")) invoice.getDouble("subtotal") else 0.0
    val serviceChargeAmount = if (invoice.hasKey("serviceChargeAmount")) invoice.getDouble("serviceChargeAmount") else 0.0
    val taxAmount = if (invoice.hasKey("vatAmount")) invoice.getDouble("vatAmount") else invoice.getDouble("tax") ?: 0.0
    val totalAmount = if (invoice.hasKey("amountDue")) invoice.getDouble("amountDue") else invoice.getDouble("total") ?: 0.0
    leftRight("Subtotal", formatNum(subtotal))
    if (serviceChargeAmount > 0.0) {
      leftRight("Service charge", formatNum(serviceChargeAmount))
    }
    leftRight("Tax", formatNum(taxAmount))
    boldOn()
    leftRight("Total:", formatNum(totalAmount))
    boldOff()
    emitStr(sepEq)
    lineFeed()
    lineFeed()

    // Payment: Cash:/Other:, Change:
    val paymentMethod = invoice.getString("paymentMethod") ?: "Cash"
    val isCash = paymentMethod.equals("Cash", ignoreCase = true)
    val payLabel = if (isCash) "Cash:" else "Other:"
    val payAmount = if (invoice.hasKey("amountDue")) invoice.getDouble("amountDue") else invoice.getDouble("total") ?: 0.0
    val changeAmount = if (invoice.hasKey("changeAmount")) invoice.getDouble("changeAmount") else 0.0
    leftRight(payLabel, formatNum(payAmount))
    leftRight("Change:", formatNum(changeAmount))
    emitStr(sep)
    lineFeed()
    lineFeed()

    // Footer
    invoice.getString("poweredBy")?.takeIf { it.isNotBlank() }?.let { emitStr(it); lineFeed() }
    lineFeed()
    boldOn()
    center("Thank You!")
    boldOff()
    lineFeed()
    lineFeed()
    cut()

    return out.toByteArray()
  }

  private fun sendToBluetooth(address: String, data: ByteArray, promise: Promise) {
    var socket: BluetoothSocket? = null
    try {
      val adapter = BluetoothAdapter.getDefaultAdapter()
        ?: throw Exception("Bluetooth not available")
      if (!adapter.isEnabled) throw Exception("Bluetooth is off")
      val device: BluetoothDevice? = adapter.getRemoteDevice(address)
      val sock = device?.createRfcommSocketToServiceRecord(SPP_UUID)
        ?: throw Exception("Device not found: $address")
      socket = sock
      sock.connect()
      val os: OutputStream = sock.outputStream
      os.write(data)
      os.flush()
      lastPrinterAddress = address
      promise.resolve(Arguments.createMap().apply {
        putBoolean("success", true)
      })
    } catch (e: Exception) {
      Log.e(TAG, "Bluetooth send error", e)
      promise.resolve(Arguments.createMap().apply {
        putBoolean("success", false)
        putString("message", e.message ?: "Connection failed")
      })
    } finally {
      try {
        socket?.close()
      } catch (_: Exception) {}
    }
  }

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }
}
