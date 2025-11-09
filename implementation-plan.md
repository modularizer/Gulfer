# Gulfer Implementation Plan

## Phase 1: MVP - Core Scoring System (No Permissions)

### Goal
Create a fully functional scorecard app that works offline, requires no permissions, and works on all platforms.

### Tasks

#### 1.1 Project Setup
- [x] Initialize React Native project structure
- [ ] Set up Expo configuration
- [ ] Configure TypeScript
- [ ] Set up folder structure
- [ ] Add basic dependencies (React Navigation, AsyncStorage, etc.)

#### 1.2 Data Models & Types
- [ ] Define TypeScript interfaces:
  - `Player`: name, id
  - `Hole`: number, par, distance (optional)
  - `Score`: playerId, holeNumber, throws
  - `Round`: id, title, date, players, scores, photos, courseName
  - `Course`: name, holes (optional for future)

#### 1.3 Storage Layer
- [ ] Implement local storage service using AsyncStorage or SQLite
- [ ] Create CRUD operations for rounds:
  - Save round
  - Load all rounds
  - Load single round
  - Delete round
  - Update round

#### 1.4 Core Components
- [ ] **Scorecard Component**
  - Grid layout (players × holes)
  - Increment button for each cell
  - Manual edit capability
  - Total score calculation
  - Add/remove players
  - Add/remove holes (for disc golf variable holes)
  
- [ ] **Round Form Component**
  - Title input
  - Date picker
  - Photo attachment (camera/gallery)
  - Course name (optional)
  - Player name inputs

#### 1.5 Screens
- [ ] **Home Screen**
  - "New Round" button
  - List of recent rounds
  - Quick stats (optional)

- [ ] **Scorecard Screen**
  - Active scorecard component
  - Save button
  - Navigation to round form

- [ ] **Round History Screen**
  - List of all saved rounds
  - Search/filter functionality
  - Sort by date

- [ ] **Round Detail Screen**
  - View saved round
  - Display scorecard
  - Show photos
  - Edit/delete options

#### 1.6 Navigation
- [ ] Set up React Navigation
- [ ] Define navigation stack
- [ ] Add navigation between screens

#### 1.7 Testing
- [ ] Test on web
- [ ] Test on Android
- [ ] Test on iOS
- [ ] Test offline functionality
- [ ] Test data persistence

### Success Criteria
- ✅ Can create a new round
- ✅ Can add players and holes
- ✅ Can record scores (button click and manual edit)
- ✅ Can save round with title and photos
- ✅ Can view saved rounds
- ✅ Works completely offline
- ✅ No permissions required
- ✅ Works on web, iOS, and Android

---

## Phase 2: GPS Tracking (Optional)

### Goal
Add optional GPS tracking to record movement and mark throw locations on a map.

### Tasks

#### 2.1 Permissions & Setup
- [ ] Request location permissions (Android & iOS)
- [ ] Handle permission denial gracefully
- [ ] Add permission request UI

#### 2.2 GPS Service
- [ ] Create GPS tracking service
- [ ] Start/stop tracking
- [ ] Record location updates
- [ ] Handle background tracking (if needed)
- [ ] Battery optimization considerations

#### 2.3 Map Integration
- [ ] Integrate React Native Maps
- [ ] Display real-time path
- [ ] Show current location
- [ ] Display throw markers
- [ ] Map controls (zoom, center)

#### 2.4 Throw Marking
- [ ] Add "Mark Throw" button to scorecard
- [ ] Record timestamp and location when button clicked
- [ ] Store throw locations with round data
- [ ] Display throw markers on map

#### 2.5 UI Updates
- [ ] Add GPS toggle to scorecard screen
- [ ] Show map view (toggle or split view)
- [ ] Display throw count on map markers
- [ ] Show path polyline

#### 2.6 Data Model Updates
- [ ] Extend Round type to include:
  - GPS path (array of coordinates with timestamps)
  - Throw locations (array of coordinates with hole numbers)

### Success Criteria
- ✅ Can enable/disable GPS tracking
- ✅ Can see real-time map with path
- ✅ Can mark throws on map
- ✅ Path and throws persist with round
- ✅ Works on Android and iOS

---

## Phase 3: Gesture Detection (Kotlin Native)

### Goal
Implement accelerometer-based gesture detection for recording throws and positions when phone is asleep.

### Tasks

#### 3.1 Kotlin Module Setup
- [ ] Create Kotlin native module structure
- [ ] Set up React Native bridge
- [ ] Configure build.gradle for Kotlin
- [ ] Create module interface

#### 3.2 Gesture Detection Logic
- [ ] Implement accelerometer reading
- [ ] Define gesture patterns:
  - Throw landing gesture
  - Hole start gesture
  - Hole end gesture
- [ ] Create gesture recognition algorithm
- [ ] Handle phone sleep state
- [ ] Background service for continuous monitoring

#### 3.3 React Native Bridge
- [ ] Create JavaScript interface
- [ ] Expose methods:
  - `startGestureDetection()`
  - `stopGestureDetection()`
  - `onGestureDetected` event listener
- [ ] Handle gesture callbacks

#### 3.4 Integration
- [ ] Add gesture toggle in app
- [ ] Connect gestures to scorecard:
  - Throw landing → increment score
  - Hole start → mark hole start location
  - Hole end → mark hole end location
- [ ] Store gesture data with round

#### 3.5 Battery Optimization
- [ ] Optimize accelerometer sampling rate
- [ ] Implement smart wake detection
- [ ] Add battery usage warnings

#### 3.6 Testing
- [ ] Test gesture recognition accuracy
- [ ] Test with phone asleep
- [ ] Test battery impact
- [ ] Calibrate gesture sensitivity

### Success Criteria
- ✅ Can detect gestures when phone is asleep
- ✅ Gestures correctly trigger scorecard actions
- ✅ Battery usage is acceptable
- ✅ Works reliably on Android

---

## Phase 4: Social Features (Future)

### Goal
Add social networking aspects for sharing and competing.

### Tasks
- [ ] User accounts (optional)
- [ ] Friend system
- [ ] Share rounds
- [ ] Leaderboards
- [ ] Course sharing
- [ ] Social feed

---

## Technical Considerations

### Performance
- Optimize scorecard rendering for many players/holes
- Efficient storage for GPS data
- Minimize battery drain for GPS and gestures

### Privacy
- All data stored locally by default
- No data collection without explicit consent
- Clear permission requests with explanations

### Cross-Platform Compatibility
- Use Expo managed workflow where possible
- Native modules only when necessary
- Test on all platforms regularly

### Data Migration
- Plan for future schema changes
- Version data models
- Migration scripts if needed

---

## Timeline Estimate

- **Phase 1 (MVP)**: 4-6 weeks
- **Phase 2 (GPS)**: 2-3 weeks
- **Phase 3 (Gestures)**: 3-4 weeks
- **Phase 4 (Social)**: TBD

---

## Development Workflow

1. Create feature branch
2. Implement feature
3. Test on all platforms
4. Code review
5. Merge to main
6. Test on staging
7. Deploy

## Dependencies to Add

### Phase 1
- `expo`
- `react-native`
- `@react-navigation/native`
- `@react-navigation/stack`
- `@react-native-async-storage/async-storage`
- `expo-image-picker`
- `expo-camera`
- `react-native-paper` or similar UI library

### Phase 2
- `react-native-maps`
- `expo-location`
- `@react-native-community/geolocation`

### Phase 3
- Kotlin standard library
- Android sensors API
- React Native bridge modules

