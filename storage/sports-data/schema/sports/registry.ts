/**
 * Sport Registry
 * 
 * Central registry for all available sports.
 * Maps sport IDs to their implementations.
 * 
 * Sports are registered by sport-specific modules (e.g., golf, tennis).
 * When registering, this also creates Sport, ScoreFormat, and EventFormat records in the database.
 */

import type { Sport } from './base';
import type { Database } from '../../../adapters';
import { SportService } from '../services/sport-service';
import { ScoreFormatService } from '../services/score-format-service';
import { EventFormatService } from '../services/event-format-service';
import type { Sport as SportRecord, ScoreFormat, EventFormat } from '../tables';
import { registerScoringMethod } from '../scoring/registry';
import type { ScoringMethod } from '../scoring/base';
import { z } from 'zod';

/**
 * Registry of all available sports
 */
const sports: Map<string, Sport> = new Map();

/**
 * Register a sport
 * This creates Sport, ScoreFormat, and EventFormat records in the database
 * Returns the initialized Sport instance for easy interaction
 */
export async function registerSport<T extends Sport>(
  sportDefinition: T,
  db: Database
): Promise<T & {
  sport: SportRecord;
  scoreFormats: ScoreFormat[];
  eventFormats: EventFormat[];
}> {
  // Register in memory
  sports.set(sportDefinition.name, sportDefinition);

  const scoreFormatService = new ScoreFormatService(db);
  const eventFormatService = new EventFormatService(db);

  // Initialize the sport with database and services (auto-registers everything)
  // This will:
  // 1. Upsert the Sport in the database
  // 2. Register all scoring methods from eventFormats
  // 3. Register all event formats
  await sportDefinition.initialize(db);
  
  // Get the registered sport and related storage
  const registeredSport = await sportDefinition.getSport();
  if (!registeredSport) {
    throw new Error(`Failed to register sport: ${sportDefinition.name}`);
  }
  
  // Get all score formats for this sport
  // Collect unique scoring method names from eventFormats
  const scoringMethodNames = new Set<string>();
  if (sportDefinition.eventFormats) {
    for (const eventFormat of sportDefinition.eventFormats) {
      scoringMethodNames.add(eventFormat.scoringMethod.name);
    }
  }
  
  const sportScoreFormats: ScoreFormat[] = [];
  for (const methodName of scoringMethodNames) {
    const formats = await scoreFormatService.getScoreFormatsByScoringMethod(methodName);
    const sportFormat = formats.find(sf => sf.sportId === registeredSport.id);
    if (sportFormat) {
      sportScoreFormats.push(sportFormat);
    }
  }
  
  // Get all event formats for this sport
  const sportEventFormats = await eventFormatService.getEventFormatsBySport(registeredSport.id);
  
  // Return the sport instance with the registration results attached
  return Object.assign(sportDefinition, {
    sport: registeredSport,
    scoreFormats: sportScoreFormats,
    eventFormats: sportEventFormats,
  });
}

/**
 * Register a sport without database (in-memory only)
 * Useful for testing or when database is not available
 */
export function registerSportInMemory(sportDefinition: Sport): void {
  sports.set(sportDefinition.name, sportDefinition);
}

/**
 * Get a sport definition by name
 */
export function getSportDefinition(name: string): Sport | undefined {
  return sports.get(name);
}

/**
 * Get all available sport definitions
 */
export function getAllSportDefinitions(): Sport[] {
  return Array.from(sports.values());
}

/**
 * Check if a sport is registered
 */
export function hasSport(name: string): boolean {
  return sports.has(name);
}

