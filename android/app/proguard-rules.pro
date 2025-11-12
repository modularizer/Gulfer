# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
    void set*(***);
    *** get*();
}
-keep class * extends com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * extends com.facebook.react.bridge.NativeModule { *; }
-keepclassmembers,includedescriptorclasses class * { native <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.UIProp <fields>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactProp <methods>; }
-keepclassmembers class *  { @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>; }
-dontwarn com.facebook.react.**
-keep,includedescriptorclasses class com.facebook.react.bridge.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo
-keepclassmembers class * {
  @expo.modules.core.interfaces.DoNotStrip *;
}
-keep @expo.modules.core.interfaces.DoNotStrip class *
-keepclassmembers class * {
  @expo.modules.core.interfaces.ExpoProp *;
}

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# react-native-svg
-keep class com.horcrux.svg.** { *; }
-keepclassmembers class com.horcrux.svg.** { *; }
-keep interface com.horcrux.svg.** { *; }
-keep enum com.horcrux.svg.** { *; }
-keep class com.horcrux.svg.RenderableView { *; }
-keep class com.horcrux.svg.RenderableViewManager { *; }
-keep class com.horcrux.svg.RenderableViewManager$* { *; }
-keep class com.horcrux.svg.SvgView { *; }
-keep class com.horcrux.svg.SvgViewModule { *; }
-keep class com.horcrux.svg.VirtualViewManager { *; }
-keep class com.horcrux.svg.SvgPackage { *; }
-keep class com.horcrux.svg.SvgPackage$* { *; }
-keepclassmembers class com.horcrux.svg.SvgPackage { *; }
-keepclassmembers class com.horcrux.svg.SvgPackage$* { *; }
-dontwarn com.horcrux.svg.**

# Add any project specific keep options here:
