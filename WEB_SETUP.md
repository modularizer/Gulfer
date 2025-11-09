# Web Setup Instructions

## Running the Web Version

After running `npm install`, you can start the web version in two ways:

### Option 1: Using npm script (Recommended)
```bash
npm run web
```

### Option 2: Using Expo CLI directly
```bash
npx expo start --web
```

### Option 3: From the Expo dev menu
1. Run `npm start` (or `npx expo start`)
2. Press `w` in the terminal to open web

## What You'll See

When you run `npm start` and go to `localhost:8082`, you'll see the Expo manifest JSON. This is **normal** - it's the API endpoint Expo uses.

To see the actual app:
- Use `npm run web` which will open the app in your browser at a different port (usually `http://localhost:8081` or similar)
- Or press `w` in the terminal where `npm start` is running

## Current Package Versions

All packages are now up-to-date and compatible with Expo SDK 51:
- React: 18.2.0 (required by React Native 0.74.5)
- React DOM: 18.2.0
- React Native Web: 0.19.13
- All Expo packages: SDK 51 compatible versions

## Troubleshooting

If you see peer dependency warnings, they're safe to ignore. React Native 0.74.5 requires exactly React 18.2.0, which is what we have installed.

