# Gulfer

A cross-platform golf and disc golf tracking application built with React Native and Kotlin.

## Overview

Gulfer is designed to help golfers and disc golfers track their games with a simple, intuitive interface. The app focuses on providing a seamless scoring experience that works offline, requires no login, and respects user privacy by minimizing permissions.

## Features

### Phase 1: MVP - Core Scoring (No Permissions Required)
- **Simple Scorecard Interface**: Spreadsheet-like scorecard to record games for you and your friends
- **Round Management**: Save rounds with custom titles, photos, and metadata
- **Score Entry**: 
  - Click-to-increment buttons for quick score entry
  - Manual number editing for precise control
- **History**: View and browse past rounds
- **Offline-First**: Works completely offline, no internet connection required
- **No Login**: No account creation or authentication needed
- **Cross-Platform**: Works on Web, iOS, and Android

### Phase 2: GPS Tracking (Optional)
- **Motion Tracking**: Track your movement during a game using GPS
- **Real-Time Map**: View your path on a map in real-time
- **Throw Marking**: Click to record throws with timestamp and location
- **Map Visualization**: Mark throws and positions on an interactive map

### Phase 3: Gesture Detection (Optional - Kotlin Native)
- **Sleep Mode Gestures**: Record throws and positions even when phone screen is off
- **Throw Landing Detection**: Gesture to mark where a throw landed
- **Hole Start/End Detection**: Different gestures to mark hole start and completion
- **Accelerometer-Based**: Uses phone's accelerometer for gesture recognition

### Phase 4: Social Features (Future)
- Social network aspects for sharing rounds and competing with friends

## Technology Stack

- **Frontend**: React Native (Expo for cross-platform compatibility)
- **Native Modules**: Kotlin for Android-specific advanced features
- **State Management**: To be determined (Redux/Zustand/Context API)
- **Storage**: Local storage (AsyncStorage/SQLite) for offline-first approach
- **Maps**: React Native Maps for GPS tracking features
- **Platforms**: Web, iOS, Android

## Project Structure

```
Gulfer/
├── README.md
├── package.json
├── app.json (Expo config)
├── tsconfig.json
├── babel.config.js
├── .gitignore
├── implementation-plan.md
├── src/
│   ├── components/
│   │   ├── Scorecard/
│   │   ├── RoundHistory/
│   │   ├── MapView/
│   │   └── common/
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── ScorecardScreen.tsx
│   │   ├── RoundHistoryScreen.tsx
│   │   └── RoundDetailScreen.tsx
│   ├── services/
│   │   ├── storage/
│   │   ├── gps/
│   │   └── gestures/
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   └── App.tsx
├── android/
│   ├── app/
│   │   ├── src/
│   │   │   └── main/
│   │   │       ├── java/
│   │   │       │   └── com/
│   │   │       │       └── gulfer/
│   │   │       │           └── MainActivity.kt
│   │   │       └── kotlin/
│   │   │           └── com/
│   │   │               └── gulfer/
│   │   │                   └── gesture/
│   │   │                       └── GestureDetector.kt
│   │   └── build.gradle
│   └── build.gradle
├── ios/
│   └── (iOS native code if needed)
└── web/
    └── (Web-specific configs)
```

## Development Setup

### Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo CLI
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)

### Installation

```bash
npm install
# or
yarn install
```

### Running the App

```bash
# Start Expo development server
npm start

# Run on specific platform
npm run android
npm run ios
npm run web
```

## Architecture Decisions

1. **Expo**: Using Expo for easier cross-platform development and faster iteration
2. **TypeScript**: Type safety across the codebase
3. **Offline-First**: All core features work without internet
4. **Permission-Based Features**: GPS and gestures are opt-in, not required
5. **Kotlin Native Modules**: For advanced Android features that require native performance

## License

TBD

