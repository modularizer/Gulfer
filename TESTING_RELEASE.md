# Testing Your Release Build Before Google Play

After building your AAB, you'll want to test it on your phone before uploading to Google Play. Here are the easiest methods:

## Quick Method: Build a Release APK

Since AAB files can't be directly installed, build a release APK using the same signing:

```bash
cd android
./gradlew assembleRelease
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### Install via USB (ADB)

1. Connect your phone via USB
2. Enable USB debugging on your phone (Settings → Developer options)
3. Install:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

### Install Manually

1. Transfer the APK to your phone (email, cloud storage, USB file transfer, etc.)
2. On your phone: Settings → Security → Enable "Install from unknown sources" (or "Install unknown apps" for newer Android)
3. Open the APK file using a file manager and install

## Alternative: Extract from AAB

If you want to test the exact AAB you built:

1. Download [bundletool](https://github.com/google/bundletool/releases)
2. Extract universal APK:
   ```bash
   java -jar bundletool.jar build-apks \
     --bundle=android/app/build/outputs/bundle/release/app-release.aab \
     --output=app-release.apks \
     --mode=universal
   
   unzip app-release.apks universal.apk
   ```
3. Install: `adb install universal.apk`

## Testing Checklist

Before uploading to Google Play, test:
- ✅ App installs correctly
- ✅ App launches without crashes
- ✅ All core features work
- ✅ No obvious bugs or issues
- ✅ App behaves the same as your debug builds

## Notes

- The release APK uses the same signing as your AAB, so it's representative
- You can uninstall and reinstall as needed
- If you find issues, fix them and rebuild both APK and AAB

