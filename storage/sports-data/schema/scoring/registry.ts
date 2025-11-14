/**
 * Scoring Method Registry
 * 
 * Central registry for all available scoring methods.
 * Maps scoring method names to their implementations.
 * 
 * Scoring methods are registered by sport-specific modules (e.g., golf, tennis).
 * When registering, this also creates ScoreFormat records in the database.
 */

import type { ScoringMethod } from './base';
import type { Database } from '../../../adapters';
import { ScoreFormatService } from '../services/score-format-service';
import type { ScoreFormat as ScoreFormatRecord, Sport } from '../tables';

/**
 * Registry of all available scoring methods
 */
const scoringMethods: Map<string, ScoringMethod> = new Map();

/**
 * Register a new scoring method
 * This also creates a ScoreFormat record in the database if provided with a database instance
 * Returns the initialized ScoringMethod instance with the score format attached
 */
export async function registerScoringMethod<T extends ScoringMethod>(
  method: T,
  options?: {
    db?: Database;
    sportId?: string;
    name?: string;
    notes?: string;
    metadata?: Record<string, any>;
  }
): Promise<T & { scoreFormat: ScoreFormatRecord | null }> {
  // Register the method in memory
  scoringMethods.set(method.name, method);

  let scoreFormat: ScoreFormatRecord | null = null;

  // If database is provided, initialize and auto-register
  if (options?.db) {
    // Initialize the scoring method with database and services (auto-registers)
    await method.initialize(options.db, options.sportId);
    
    // Get the registered score format
    scoreFormat = await method.getScoreFormat();
  }

  // Return the method instance with the score format attached
  return Object.assign(method, { scoreFormat });
}

/**
 * Register a scoring method without database (in-memory only)
 * Useful for testing or when database is not available
 */
export function registerScoringMethodInMemory(method: ScoringMethod): void {
  scoringMethods.set(method.name, method);
}

/**
 * Get a scoring method by name
 */
export function getScoringMethod(name: string): ScoringMethod | undefined {
  return scoringMethods.get(name);
}

/**
 * Get all available scoring methods
 */
export function getAllScoringMethods(): ScoringMethod[] {
  return Array.from(scoringMethods.values());
}

/**
 * Get scoring methods for a specific sport
 */
export function getScoringMethodsForSport(sportId: string): ScoringMethod[] {
  // TODO: Implement logic to filter by sportId if needed, perhaps via metadata on ScoreFormat
  return getAllScoringMethods();
}

/**
 * Check if a scoring method exists
 */
export function hasScoringMethod(name: string): boolean {
  return scoringMethods.has(name);
}
