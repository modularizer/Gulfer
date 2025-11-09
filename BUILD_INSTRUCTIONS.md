# Android Build Instructions

## Prerequisites

1. **Install Java JDK 17:**
   ```bash
   sudo apt update
   sudo apt install -y openjdk-17-jdk
   ```

2. **Set JAVA_HOME:**
   ```bash
   export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
   export PATH=$JAVA_HOME/bin:$PATH
   ```
   Add these to your `~/.bashrc` or `~/.zshrc` to make them permanent.

3. **Install Android SDK:**
   - Download Android Studio from https://developer.android.com/studio
   - Or install command-line tools:
     ```bash
     mkdir -p ~/Android/Sdk
     cd ~/Android/Sdk
     wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
     unzip commandlinetools-linux-9477386_latest.zip
     mkdir -p cmdline-tools/latest
     mv cmdline-tools/* cmdline-tools/latest/ 2>/dev/null || true
     ```
   - Accept licenses and install SDK:
     ```bash
     ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager --licenses
     ~/Android/Sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
     ```

4. **Set ANDROID_HOME:**
   ```bash
   export ANDROID_HOME=~/Android/Sdk
   export PATH=$ANDROID_HOME/platform-tools:$PATH
   ```
   Add these to your `~/.bashrc` or `~/.zshrc`.

5. **Create local.properties:**
   ```bash
   echo "sdk.dir=$ANDROID_HOME" > android/local.properties
   ```

## Build the APK

After setting up the prerequisites:

```bash
cd /home/mod/Code/Gulfer/android
./gradlew assembleRelease
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

## Troubleshooting

- If you see "components.release" errors, this is a known issue with expo-modules-core publishing configuration. The build should still work for creating the APK.
- If you see plugin errors, make sure you've run `npx expo prebuild --platform android --clean` first.
