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

## Step 4: Upload to Google Play Console

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app (or create a new one)
3. Go to **Production** (or **Testing** → **Internal testing** for testing)
4. Click **Create new release**
5. Upload the `app-release.aab` file
6. Fill in release notes and other required information
7. Review and roll out

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

