# SOMNO-PULSE ProGuard rules — keep the Capacitor bridge and native somnology plugins.
-keep class com.somnopulse.sleep.** { *; }
-keep class com.getcapacitor.** { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
}
-dontwarn com.getcapacitor.**
