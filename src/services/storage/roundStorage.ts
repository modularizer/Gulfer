/**
 * Storage service for managing rounds locally
 * Uses localforage (IndexedDB on web, native storage on mobile) for larger quota support
 */

import { getItem, setItem } from './storageAdapter';
import { Round } from '../../types';

const ROUNDS_STORAGE_KEY = '@gulfer_rounds';

/**
 * Save a round to local storage
 */
export async function saveRound(round: Round): Promise<void> {
  try {
    const rounds = await getAllRounds();
    const existingIndex = rounds.findIndex((r) => r.id === round.id);
    
    if (existingIndex >= 0) {
      rounds[existingIndex] = round;
    } else {
      rounds.push(round);
    }
    
    await setItem(ROUNDS_STORAGE_KEY, JSON.stringify(rounds));
  } catch (error: any) {
    console.error('Error saving round:', error);
    
    // Check if it's a quota exceeded error
    if (error?.name === 'QuotaExceededError' || error?.message?.includes('quota') || error?.message?.includes('QuotaExceeded')) {
      const quotaError = new Error('Storage quota exceeded. Please delete some old rounds or remove photos to free up space.');
      (quotaError as any).name = 'QuotaExceededError';
      throw quotaError;
    }
    
    throw error;
  }
}

/**
 * Get all saved rounds
 */
export async function getAllRounds(): Promise<Round[]> {
  try {
    const data = await getItem(ROUNDS_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error loading rounds:', error);
    return [];
  }
}

/**
 * Get a single round by ID
 */
export async function getRoundById(roundId: string): Promise<Round | null> {
  try {
    const rounds = await getAllRounds();
    return rounds.find((r) => r.id === roundId) || null;
  } catch (error) {
    console.error('Error loading round:', error);
    return null;
  }
}

/**
 * Delete a round by ID
 */
export async function deleteRound(roundId: string): Promise<void> {
  try {
    const rounds = await getAllRounds();
    const filtered = rounds.filter((r) => r.id !== roundId);
    await setItem(ROUNDS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting round:', error);
    throw error;
  }
}

/**
 * Generate a new unique round ID based on date/time
 */
export function generateRoundId(): string {
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2025-01-15T14-30-45
  return dateStr;
}

/**
 * Generate a round title from date and time
 */
export function generateRoundTitle(date: number): string {
  const d = new Date(date);
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const formattedDate = d.toLocaleDateString('en-US', dateOptions);
  const formattedTime = d.toLocaleTimeString('en-US', timeOptions);
  return `${formattedDate} @${formattedTime}`;
}

/**
 * Create a new round with auto-generated ID and title
 */
export async function createNewRound(initialData: {
  players: Round['players'];
  notes?: string;
  photos?: string[];
  courseName?: string;
  gameType?: 'golf' | 'disc-golf';
  date?: number; // Optional custom date (Unix timestamp)
}): Promise<Round> {
  const date = initialData.date || Date.now();
  const roundId = generateRoundId();
  const title = generateRoundTitle(date);

  const newRound: Round = {
    id: roundId,
    title,
    date,
    players: initialData.players,
    scores: [],
    notes: initialData.notes,
    photos: initialData.photos,
    courseName: initialData.courseName,
    gameType: initialData.gameType || 'disc-golf',
  };

  await saveRound(newRound);
  return newRound;
}

