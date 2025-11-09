# Quick Start Guide

## Initial Setup

1. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Install Expo CLI** (if not already installed)
   ```bash
   npm install -g expo-cli
   ```

3. **Start Development Server**
   ```bash
   npm start
   ```

4. **Run on Platform**
   - **Web**: Press `w` in the terminal or visit the URL shown
   - **Android**: Press `a` in the terminal (requires Android emulator or device)
   - **iOS**: Press `i` in the terminal (requires macOS and Xcode)

## Project Structure Overview

```
Gulfer/
├── src/                    # Main source code
│   ├── components/         # Reusable UI components
│   ├── screens/           # Screen components
│   ├── services/          # Business logic and services
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Utility functions
├── android/               # Android native code (Kotlin)
├── ios/                   # iOS native code (if needed)
└── assets/                # Images, fonts, etc.
```

## Next Steps

1. **Phase 1 (MVP)**: Implement the core scorecard functionality
   - Complete the ScorecardScreen implementation
   - Implement round saving and loading
   - Add photo attachment functionality
   - Test on all platforms

2. **Phase 2 (GPS)**: Add optional GPS tracking
   - Install react-native-maps
   - Implement GPS service
   - Add map view to scorecard

3. **Phase 3 (Gestures)**: Add Kotlin gesture detection
   - Complete gesture detection algorithm
   - Test on Android devices
   - Integrate with scorecard

## Development Notes

- The app uses Expo for cross-platform development
- TypeScript is configured for type safety
- React Native Paper is used for UI components
- AsyncStorage is used for local data persistence (Phase 1)
- Kotlin modules are in `android/app/src/main/kotlin/`

## Troubleshooting

- **Module not found errors**: Run `npm install` again
- **Metro bundler issues**: Clear cache with `npm start -- --reset-cache`
- **Android build issues**: Make sure Android Studio and SDK are properly configured
- **Type errors**: These may appear until dependencies are installed

