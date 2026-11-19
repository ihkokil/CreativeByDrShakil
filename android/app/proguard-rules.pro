# Keep JavascriptInterface bridge methods intact during R8/ProGuard minification
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keepattributes *Annotation*
-keep class com.creativebydrshakil.app.MainActivity$AndroidBridge { *; }
-dontwarn androidx.webkit.**
