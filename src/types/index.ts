/**
 * Core data types for Gulfer app
 */

export interface Player {
  id: string;
  name: string;
}

export interface Hole {
  number: number;
  par?: number;
  distance?: number; // in meters/feet
}

export interface Score {
  playerId: string;
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
  id: string;
  title: string;
  date: number; // Unix timestamp
  players: Player[];
  scores: Score[];
  photos?: string[]; // Image hashes (for deduplication)
  courseName?: string;
  notes?: string;
  gameType: 'golf' | 'disc-golf';
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
  id: string;
  name: string;
  holes: Hole[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

