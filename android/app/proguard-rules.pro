# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep native modules (reflection-based)
-keep class com.nrestomobile.ThermalPrinterModule { *; }
-keep class com.nrestomobile.ThermalPrinterPackage { *; }
-keep class com.nrestomobile.ImageDownloadModule { *; }
-keep class com.nrestomobile.ImageDownloadPackage { *; }
-keep class com.nrestomobile.OrderSyncMonitorModule { *; }
-keep class com.nrestomobile.OrderSyncMonitorPackage { *; }
-keep class com.nrestomobile.OrderSyncHeadlessService { *; }

# Keep ReactPackage implementations
-keep class * implements com.facebook.react.ReactPackage { *; }
