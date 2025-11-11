# Building a Signed Production AAB for Google Play Store

This guide will help you build a signed Android App Bundle (AAB) for publishing to the Google Play Store.

## Prerequisites

- ✅ You have a Google Play Developer account
- ✅ Your APK is working correctly
- ✅ Java JDK is installed (for keytool)

## Step 1: Generate a Production Keystore

**IMPORTANT**: This keystore is required for all future updates. Keep it safe and backed up!

### Option A: Using the provided script (Recommended)

```bash
cd android
./generate-keystore.sh
```

The script will guide you through the process. You'll need to:
- Enter a keystore password (remember this!)
- Enter your name and organization details
- Enter a key password (can be same as keystore password)

### Option B: Manual generation

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore gulfer-release-key.keystore -alias gulfer-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Replace:
- `gulfer-release-key.keystore` with your desired keystore filename
- `gulfer-key-alias` with your desired key alias
- `10000` is validity in days (~27 years)

## Step 2: Configure Keystore Credentials

You have two options for storing keystore credentials:

### Option A: Use gradle.properties.local (Recommended for Security)

Create `android/gradle.properties.local` (this file is gitignored) and add:

```properties
MYAPP_RELEASE_STORE_FILE=gulfer-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=gulfer-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password-here
MYAPP_RELEASE_KEY_PASSWORD=your-key-password-here
```

Gradle will automatically load this file if it exists, and it won't be committed to git.

### Option B: Edit gradle.properties directly

Edit `android/gradle.properties` and uncomment/fill in these lines:

```properties
MYAPP_RELEASE_STORE_FILE=gulfer-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=gulfer-key-alias
MYAPP_RELEASE_STORE_PASSWORD=your-keystore-password-here
MYAPP_RELEASE_KEY_PASSWORD=your-key-password-here
```

**Security Note**: If using Option B, be careful not to commit passwords to git. The `gradle.properties.local` file (Option A) is automatically ignored and is the safer approach.

## Step 3: Build the AAB

From the project root:

```bash
cd android
./gradlew bundleRelease
```

Or from the project root:

```bash
cd android && ./gradlew bundleRelease
```

The signed AAB will be generated at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

## Step 3.5: Test the Release Build on Your Phone

**Important**: AAB files cannot be directly installed on devices. You need to either build a release APK or use bundletool to extract APKs from the AAB.

### Option A: Build a Release APK for Testing (Recommended)

Build a signed release APK using the same signing configuration:

```bash
cd android
./gradlew assembleRelease
```

The signed APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

You can then install it on your phone:
1. Transfer the APK to your phone (via USB, email, cloud storage, etc.)
2. On your phone, enable "Install from unknown sources" in Settings
3. Open the APK file and install it

Or use ADB to install directly:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Option B: Extract APKs from AAB using bundletool

If you want to test the exact AAB you'll upload:

1. Download bundletool from [GitHub](https://github.com/google/bundletool/releases)
2. Extract APKs from your AAB:
   ```bash
   java -jar bundletool.jar build-apks \
     --bundle=android/app/build/outputs/bundle/release/app-release.aab \
     --output=app-release.apks \
     --mode=universal
   ```
3. Extract the universal APK:
   ```bash
   unzip app-release.apks universal.apk
   ```
4. Install on your phone:
   ```bash
   adb install universal.apk
   ```

**Note**: The release APK (Option A) is simpler and uses the same signing, so it's the recommended approach for testing.

## Step 4: Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (or create a new one)
3. Go to **Production** (or **Testing** → **Internal testing** for testing)
4. Click **Create new release**
5. Upload the `app-release.aab` file
6. **Upload the deobfuscation mapping file** (see Step 4.5 below)
7. Fill in release notes and other required information
8. Review and roll out

## Step 4.5: Upload Deobfuscation Mapping File

R8/ProGuard code shrinking and obfuscation is enabled in release builds (configured in `android/gradle.properties`). This makes your code smaller but also obfuscates it. To help debug crashes and ANRs, you should upload the mapping file to Google Play Console.

### Where to Find the Mapping File

After building your AAB with `./gradlew bundleRelease`, the mapping file is automatically generated at:
```
android/app/build/outputs/mapping/release/mapping.txt
```

**Note**: If the mapping file doesn't exist, make sure:
1. You've enabled ProGuard by setting `android.enableProguardInReleaseBuilds=true` in `android/gradle.properties` (already configured)
2. You've built the release AAB using `./gradlew bundleRelease` (not just `assembleRelease`)
3. The build completed successfully

### How to Upload to Play Console

1. After uploading your AAB file in Step 4, you'll see a section for "Deobfuscation file"
2. Click **Upload** and select the `mapping.txt` file from the path above
3. The mapping file must match the exact version of the AAB you uploaded

**Important**: 
- Keep a copy of each `mapping.txt` file for each release version
- The mapping file is unique to each build - you cannot use an old mapping file with a new AAB
- Without the mapping file, crash reports will show obfuscated class/method names, making debugging much harder

### Alternative: Automatic Upload (Advanced)

If you want to automate this, you can configure your build to automatically upload the mapping file, but manual upload through Play Console is the standard approach.

## Troubleshooting

### Error: "Keystore file not found"
- Make sure the keystore file is in `android/app/` directory
- Check that `MYAPP_RELEASE_STORE_FILE` in `gradle.properties` matches the actual filename

### Error: "Keystore was tampered with, or password was incorrect"
- Double-check your passwords in `gradle.properties`
- Make sure there are no extra spaces or special characters

### Error: "Signing config not found"
- Ensure all four properties are set in `gradle.properties`:
  - `MYAPP_RELEASE_STORE_FILE`
  - `MYAPP_RELEASE_KEY_ALIAS`
  - `MYAPP_RELEASE_STORE_PASSWORD`
  - `MYAPP_RELEASE_KEY_PASSWORD`

### Build succeeds but AAB is not signed
- Check that `signingConfig signingConfigs.release` is set in the `release` buildType (already configured)

### Warning: "There is no deobfuscation file associated with this App Bundle"
- This is a warning, not an error - your AAB will still work
- R8/ProGuard must be enabled to generate the mapping file
- ProGuard is enabled by default (see `android/gradle.properties`)
- After building with `./gradlew bundleRelease`, find the mapping file at: `android/app/build/outputs/mapping/release/mapping.txt`
- Upload it in Play Console when uploading your AAB (see Step 4.5 above)
- If the mapping file doesn't exist:
  - Verify `android.enableProguardInReleaseBuilds=true` is set in `android/gradle.properties`
  - Rebuild your AAB: `cd android && ./gradlew clean bundleRelease`
  - Check that the build completed successfully without errors

## Important Notes

1. **Keep your keystore safe**: If you lose it, you cannot update your app on Google Play Store. You'll have to create a new app listing.

2. **Version Code**: Make sure to increment `versionCode` in `android/app/build.gradle` for each release:
   ```gradle
   versionCode 1  // Increment this for each release
   versionName "0.1.0"  // Update this too
   ```

3. **Testing**: Before uploading to production, test the AAB using Google Play's internal testing track.

4. **App Signing**: Google Play offers "Play App Signing" which lets Google manage your signing key. This is recommended for added security.

## Next Steps After First Upload

After your first upload, Google Play may offer to manage your signing key (Play App Signing). This is recommended as it:
- Provides additional security
- Allows key recovery if lost
- Enables app optimization features

You can opt-in during the first release or later in App Signing settings.

