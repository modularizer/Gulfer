/**
 * Core data types for Gulfer app
 */

export interface Player {
  id: string; // UUID for global uniqueness
  name: string; // Locally unique name
}

export interface Hole {
  number: number;
  par?: number;
  distance?: number; // in meters/feet
}

export interface Score {
  playerId: string; // UUID reference to Player
  holeNumber: number;
  throws: number;
}

export interface ThrowLocation {
  holeNumber: number;
  timestamp: number;
  latitude: number;
  longitude: number;
}

export interface GPSPathPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface Round {
  id: string; // UUID for global uniqueness
  title: string;
  date: number; // Unix timestamp
  players: Player[];
  scores: Score[];
  photos?: string[]; // Image hashes (for deduplication)
  courseName?: string; // Locally unique course name
  courseId?: string; // Course UUID
  notes?: string;
  // Phase 2: GPS data
  gpsPath?: GPSPathPoint[];
  throwLocations?: ThrowLocation[];
  // Phase 3: Gesture data
  gestureData?: {
    holeStarts: Array<{ holeNumber: number; timestamp: number }>;
    holeEnds: Array<{ holeNumber: number; timestamp: number }>;
    throwLandings: Array<{ holeNumber: number; timestamp: number }>;
  };
}

export interface Course {
  id: string; // UUID for global uniqueness
  name: string; // Locally unique name
  holes: Hole[];
  location?: {
    latitude: number;
    longitude: number;
  };
  notes?: string;
}

