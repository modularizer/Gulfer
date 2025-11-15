/**
 * Base Scoring System
 *
 * Defines the core types and interfaces that all scoring methods must implement.
 * This provides a consistent interface for scoring across all sports.
 */

import type { EventStage } from '../tables';
import type { z } from 'zod';
import type { Database } from '../../../../xp-deeby/adapters';
import { ScoreFormatService } from '../services';
import type { ScoreFormat as ScoreFormatRecord } from '../tables';

// ============================================================================
// Core Types
// ============================================================================

export type PlayerId = string;
export type Value = any;

/**
 * Raw input values from players for a stage
 */
export type PlayerValues = Record<PlayerId, Value>;

/**
 * Simple result from scoring implementation - only what the implementation computes
 */
export type SimplePlayerResult = {
    value: Value | null | undefined; // The raw score value (nullable)
    points?: number | null; // Points awarded for this stage (optional - defaults to value if value is a number, must be null/undefined if value is null/undefined)
    scoreType: string; // Descriptive score type (e.g., 'hole-in-one', 'eagle', 'birdie', 'ace', 'three-pointer')
    stats: Record<string, any>; // Additional statistics
};

/**
 * Simple group result from scoring implementation
 */
export type SimpleGroupResult = {
    playerResults?: Record<PlayerId, SimplePlayerResult>; // Optional - if not provided, will be computed from stage results
    stats: Record<string, any>; // Group-level statistics
};

/**
 * Full result with all computed fields (winners, losers, place, etc.)
 * This is computed by the wrapper based on points
 */
export type PlayerResult = {
    value: Value | null | undefined; // The raw score value (nullable)
    place: number; // Ranking (1 = first, 2 = second, etc.)
    placeFromEnd: number; // Ranking from last (1 = last place)
    points: number | null; // Points awarded for this stage (nullable - null if value is null/undefined)
    won: boolean; // Whether this player won this stage
    lost: boolean; // Whether this player lost this stage
    scoreType: string; // Descriptive score type (e.g., 'hole-in-one', 'eagle', 'birdie', 'ace', 'three-pointer')
    stats: Record<string, any>; // Additional statistics
};

/**
 * Full group result with winners, losers, etc.
 */
export type GroupResult = {
    playerResults: Record<PlayerId, PlayerResult>;
    winners: PlayerId[]; // Player IDs who won/tied for first
    winningPoints: number; // Points awarded to winners
    stats: Record<string, any>; // Group-level statistics
};

/**
 * Metadata for a stage (e.g., hole par, set number, heat lane assignments)
 */
export type StageMetadata = Record<string, any>;

/**
 * Information needed to score a single stage
 */
export interface StageScoringInfo {
    playerValues: PlayerValues; // Raw input values from players
    previousStageResults: GroupResult[]; // Results from previous stages (for cumulative scoring)
    stageInfo: {
        stage: EventStage;
        metadata: StageMetadata | null;
    };
    eventInfo: {
        eventId: string;
        metadata: Record<string, any> | null;
    };
    // Precomputed stats from playerValues
    precomputedStats: {
        totalPlayers: number;
        averageValue: number | null;
        averagePoints: number | null;
    };
}

/**
 * Information needed to score an entire event
 */
export interface EventScoringInfo {
    stageResults: GroupResult[]; // All stage results (already computed with winners, etc.)
    aggregated: SimpleGroupResult; // Precomputed sums of values and points from all stages
    eventInfo: {
        eventId: string;
        metadata: Record<string, any> | null;
    };
    // Precomputed stats from aggregated results
    precomputedStats: {
        totalPlayers: number;
        averageValue: number | null;
        averagePoints: number | null;
    };
}

// ============================================================================
// Scoring Method Interface
// ============================================================================

/**
 * Function type for converting a raw value to points
 * Defaults to identity function (value => value) if not provided
 */
export type ValueToPoints = (value: Value) => number | null;

/**
 * Function type for determining score type from value and stage info
 * Optional - if not provided, scoreType will be empty string
 */
export type ValueToScoreType = (value: Value, stageInfo: { stage: EventStage; metadata: StageMetadata | null }) => string;

/**
 * Function type for scoring a single stage
 * Implementations should ONLY compute points, stats, and scoreType
 * The wrapper will handle winners, losers, place, etc. based on points
 */
export type ScoreStage = (info: StageScoringInfo) => SimpleGroupResult;

/**
 * Function type for scoring an entire event
 * Implementations should ONLY compute points, stats, and scoreType
 * The wrapper will handle winners, losers, place, etc. based on points
 */
export type ScoreEvent = (info: EventScoringInfo) => SimpleGroupResult;

/**
 * Static registry of all scoring method instances
 * Automatically populated when ScoringMethod subclasses are instantiated
 */
const scoringMethodRegistry = new Map<string, ScoringMethod>();

/**
 * Get a scoring method by name from the registry
 *
 * Note: Scoring methods auto-register when their modules are imported.
 * Make sure to import sport modules (e.g., from '../../golf') to register their scoring methods.
 */
export function getScoringMethod(name: string): ScoringMethod | undefined {
    return scoringMethodRegistry.get(name);
}

/**
 * Get all registered scoring methods
 */
export function getAllScoringMethods(): ScoringMethod[] {
    return Array.from(scoringMethodRegistry.values());
}

/**
 * Abstract base class that all scoring methods must extend
 * This class provides both the scoring method definition and driver functionality
 *
 * Instances automatically register themselves in the static registry when constructed
 */
export abstract class ScoringMethod {
    /**
     * Name of the scoring method (e.g., 'stroke-play', 'match-play', 'time-trial')
     */
    abstract readonly name: string;

    /**
     * Description of the scoring method
     */
    abstract readonly description: string;

    /**
     * Sport this scoring method is designed for (optional, can be used by multiple sports)
     */
    sportType?: string;

    /**
     * Whether higher points are better (true) or lower points are better (false)
     * Used by the wrapper to determine winners, losers, and rankings
     */
    abstract readonly higherPointsBetter: boolean;

    /**
     * Whether score changes propagate to subsequent sibling stages
     * If true, modifying a score in a stage will trigger recomputation of all subsequent sibling stages
     * If false, only the current stage is recomputed (parent stages are always recomputed)
     * Default: false (e.g., golf - modifying an old hole doesn't affect other holes)
     * Example true: bowling - modifying a frame affects subsequent frames
     * Note: Parent stages (event totals) are always recomputed regardless of this setting
     */
    propagatesToSiblingStages?: boolean;

    /**
     * Database instance - set during registration
     */
    protected db?: Database;

    /**
     * Score format service - initialized during registration
     */
    protected scoreFormatService?: ScoreFormatService;

    /**
     * Cached score format ID (16-character hex) - set after registration
     */
    _cachedScoreFormatId?: string;

    /**
     * Track if this instance has been registered
     */
    private _registered = false;

    /**
     * Constructor - defers registration until after subclass properties are set
     */
    constructor() {
        // Defer registration to next tick to ensure subclass property initializers have run
        // Property initializers run after base constructor but before subclass constructor
        queueMicrotask(() => {
            this._ensureRegistered();
        });
    }

    /**
     * Ensure this instance is registered in the static registry
     * Called from constructor (deferred) and initialize() to handle timing issues
     */
    private _ensureRegistered(): void {
        if (this._registered) return;

        // Access name property - should be set by subclass property initializers by now
        const name = this.name;
        if (name && typeof name === 'string') {
            scoringMethodRegistry.set(name, this);
            this._registered = true;
        }
    }

    /**
     * Initialize the scoring method with database and services
     * Automatically registers itself in the database (upserts ScoreFormat)
     * @param db - Database instance
     * @param sportId - Optional sport ID to associate with
     */
    async initialize(db: Database, sportId?: string): Promise<void> {
        this.db = db;
        this.scoreFormatService = new ScoreFormatService(db);

        // Ensure we're registered in the static registry
        this._ensureRegistered();

        // Auto-register: upsert ScoreFormat in database
        await this._selfRegister(sportId);
    }

    /**
     * Internal method to self-register in the database
     */
    private async _selfRegister(sportId?: string): Promise<void> {
        if (!this.scoreFormatService) {
            throw new Error('ScoreFormatService not initialized');
        }

        // Check if score format already exists
        const existing = await this.scoreFormatService.getScoreFormatsByScoringMethod(this.name);
        let scoreFormat: ScoreFormatRecord | null = null;

        if (existing.length > 0 && sportId) {
            // Check if one exists for this sport
            const sportSpecific = existing.find(sf => sf.sportId === sportId);
            if (sportSpecific) {
                scoreFormat = sportSpecific;
                this._cachedScoreFormatId = sportSpecific.id;
            }
        } else if (existing.length > 0 && !sportId) {
            // If no sportId specified, use the first one found (or create a generic one)
            scoreFormat = existing[0];
            this._cachedScoreFormatId = existing[0].id;
        }

        // Create new score format if it doesn't exist
        if (!scoreFormat) {
            scoreFormat = await this.scoreFormatService.createScoreFormat({
                name: this.name,
                notes: this.description,
                sportId: sportId || null,
                scoringMethodName: this.name,
                metadata: null,
            });
            this._cachedScoreFormatId = scoreFormat.id;
        } else {
            // Update existing score format if needed (upsert)
            // Only update if sportId is provided and different, or if name/notes changed
            const needsUpdate =
                (sportId && scoreFormat.sportId !== sportId) ||
                scoreFormat.name !== this.name ||
                scoreFormat.notes !== this.description ||
                scoreFormat.scoringMethodName !== this.name;

            if (needsUpdate) {
                await this.scoreFormatService.updateScoreFormat(scoreFormat.id, {
                    name: this.name,
                    notes: this.description,
                    sportId: sportId || scoreFormat.sportId || null,
                    scoringMethodName: this.name,
                });
            }
        }
    }

    /**
     * Get the cached score format ID (16-character hex)
     */
    getScoreFormatId(): string {
        if (!this._cachedScoreFormatId) {
            throw new Error(`Score format for "${this.name}" has not been registered in the database yet.`);
        }
        return this._cachedScoreFormatId;
    }

    /**
     * Get the score format from the database
     */
    async getScoreFormat(): Promise<ScoreFormatRecord | null> {
        if (!this.scoreFormatService) {
            throw new Error('Scoring method has not been initialized with a database. Call registerScoringMethod first.');
        }
        const scoreFormatId = this.getScoreFormatId();
        return await this.scoreFormatService.getScoreFormat(scoreFormatId);
    }

    /**
     * Get all score formats using this scoring method
     */
    async getScoreFormats(): Promise<ScoreFormatRecord[]> {
        if (!this.scoreFormatService) {
            throw new Error('Scoring method has not been initialized with a database. Call registerScoringMethod first.');
        }
        return await this.scoreFormatService.getScoreFormatsByScoringMethod(this.name);
    }

    /**
     * Convert a raw value to points
     * Defaults to identity function (value => value) if not provided
     * Only used if scoreStage is not provided
     */
    valueToPoints?: ValueToPoints;

    /**
     * Determine score type from value and stage info
     * Optional - if not provided, scoreType will be empty string
     * Only used if scoreStage is not provided
     */
    valueToScoreType?: ValueToScoreType;

    /**
     * Score a single stage (optional)
     * If not provided, a default implementation will be used that:
     * - Uses valueToPoints to convert values to points
     * - Uses valueToScoreType to determine score types (if provided)
     * - Returns empty stats
     * Should ONLY compute: points, stats, scoreType per player, and overall stats
     * The wrapper will compute winners, losers, place, placeFromEnd, won, lost based on points
     */
    scoreStage?: ScoreStage;

    /**
     * Score an entire event (optional)
     * If not provided, the wrapper will automatically aggregate stage results
     * Should ONLY compute: points, stats, scoreType per player (optional), and overall stats
     * The wrapper will compute winners, losers, place, placeFromEnd, won, lost based on points
     * If playerResults is not provided, they will be computed by summing stage results
     */
    scoreEvent?: ScoreEvent;

    /**
     * Zod schema for validating score values
     * If provided, this will be checked first before validateValue function
     */
    valueSchema?: z.ZodTypeAny;

    validateValue(
        value: Value
    ): boolean {
        // First check Zod schema if provided
        if (this.valueSchema) {
            try {
                this.valueSchema.parse(value);
            } catch (error) {
                // Zod validation failed
                return false;
            }
        }


        // If neither is provided, value is considered valid
        return true;
    }



    /**
     * Format a score value for display
     */
    formatValue?: (value: Value) => string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate place rankings from values
 * Lower values rank better (e.g., golf strokes, time)
 * Null/undefined values are ranked last
 */
export function rankByLowest(values: Record<PlayerId, number | null>): Record<PlayerId, number> {
    // Separate players with values from those without
    const withValues: Array<[PlayerId, number]> = [];
    const withoutValues: PlayerId[] = [];

    for (const [playerId, value] of Object.entries(values)) {
        if (value === null || value === undefined) {
            withoutValues.push(playerId);
        } else {
            withValues.push([playerId, value]);
        }
    }

    // Sort players with values (ascending)
    withValues.sort(([, a], [, b]) => a - b);

    const ranks: Record<PlayerId, number> = {};
    let currentRank = 1;
    let previousValue: number | null = null;

    for (const [playerId, value] of withValues) {
        if (previousValue !== null && value !== previousValue) {
            currentRank = Object.keys(ranks).length + 1;
        }
        ranks[playerId] = currentRank;
        previousValue = value;
    }

    // Rank players without values last
    const lastRank = Object.keys(ranks).length + 1;
    for (const playerId of withoutValues) {
        ranks[playerId] = lastRank;
    }

    return ranks;
}

/**
 * Calculate place rankings from values
 * Higher values rank better (e.g., points, distance)
 * Null/undefined values are ranked last
 */
export function rankByHighest(values: Record<PlayerId, number | null>): Record<PlayerId, number> {
    // Separate players with values from those without
    const withValues: Array<[PlayerId, number]> = [];
    const withoutValues: PlayerId[] = [];

    for (const [playerId, value] of Object.entries(values)) {
        if (value === null || value === undefined) {
            withoutValues.push(playerId);
        } else {
            withValues.push([playerId, value]);
        }
    }

    // Sort players with values (descending)
    withValues.sort(([, a], [, b]) => b - a);

    const ranks: Record<PlayerId, number> = {};
    let currentRank = 1;
    let previousValue: number | null = null;

    for (const [playerId, value] of withValues) {
        if (previousValue !== null && value !== previousValue) {
            currentRank = Object.keys(ranks).length + 1;
        }
        ranks[playerId] = currentRank;
        previousValue = value;
    }

    // Rank players without values last
    const lastRank = Object.keys(ranks).length + 1;
    for (const playerId of withoutValues) {
        ranks[playerId] = lastRank;
    }

    return ranks;
}

/**
 * Calculate place from end (1 = last place)
 */
export function calculatePlaceFromEnd(
    place: number,
    totalPlayers: number
): number {
    return totalPlayers - place + 1;
}

/**
 * Determine winners (players with place = 1)
 */
export function getWinners(playerResults: Record<PlayerId, PlayerResult>): PlayerId[] {
    return Object.entries(playerResults)
        .filter(([, result]) => result.place === 1)
        .map(([playerId]) => playerId);
}

/**
 * Aggregate stage results into event results
 * Sums points across all stages for each player
 */
export function aggregateStageResults(
    stageResults: GroupResult[]
): SimpleGroupResult {
    if (stageResults.length === 0) {
        return {
            stats: {
                totalPlayers: 0,
                averageValue: null,
                averagePoints: null,
            },
        };
    }

    // Sum points across all stages for each player
    const aggregatedPoints: Record<PlayerId, number | null> = {};
    const aggregatedValues: Record<PlayerId, number | null> = {};
    const playerStats: Record<PlayerId, { stagesPlayed: number; totalValue: number | null }> = {};
    const allPlayerIds = new Set<PlayerId>();

    for (const stageResult of stageResults) {
        for (const [playerId, result] of Object.entries(stageResult.playerResults)) {
            allPlayerIds.add(playerId);

            if (!playerStats[playerId]) {
                playerStats[playerId] = { stagesPlayed: 0, totalValue: null };
                aggregatedPoints[playerId] = null;
                aggregatedValues[playerId] = null;
            }

            playerStats[playerId].stagesPlayed++;

            // Sum points (handle null)
            if (result.points !== null) {
                if (aggregatedPoints[playerId] === null) {
                    aggregatedPoints[playerId] = 0;
                }
                aggregatedPoints[playerId] = aggregatedPoints[playerId]! + result.points;
            }

            // Sum values (handle null)
            if (result.value !== null && result.value !== undefined && typeof result.value === 'number') {
                if (aggregatedValues[playerId] === null) {
                    aggregatedValues[playerId] = 0;
                }
                aggregatedValues[playerId] = aggregatedValues[playerId]! + result.value;
            }
        }
    }

    // Build simple player results
    const playerResults: Record<PlayerId, SimplePlayerResult> = {};
    for (const playerId of allPlayerIds) {
        const stats = playerStats[playerId];
        playerResults[playerId] = {
            value: aggregatedValues[playerId] ?? null,
            points: aggregatedPoints[playerId] ?? null,
            scoreType: 'total',
            stats: {
                stagesPlayed: stats.stagesPlayed,
                totalValue: aggregatedValues[playerId],
                totalPoints: aggregatedPoints[playerId],
            },
        };
    }

    // Auto-compute averagePoints, averageValue, totalPlayers
    let totalValue = 0;
    let totalPoints = 0;
    let valueCount = 0;
    let pointsCount = 0;

    for (const result of Object.values(playerResults)) {
        if (result.value !== null && result.value !== undefined && typeof result.value === 'number') {
            totalValue += result.value;
            valueCount++;
        }
        if (result.points !== null && result.points !== undefined && typeof result.points === 'number') {
            totalPoints += result.points;
            pointsCount++;
        }
    }

    const averageValue = valueCount > 0 ? totalValue / valueCount : null;
    const averagePoints = pointsCount > 0 ? totalPoints / pointsCount : null;
    const totalPlayers = Object.keys(playerResults).length;

    return {
        playerResults,
        stats: {
            totalPlayers,
            averageValue,
            averagePoints,
        },
    };
}

/**
 * Convert a simple group result to a full group result
 * Computes winners, losers, place, placeFromEnd, won, lost based on points
 * If playerResults is not provided, they will be computed from stage results
 * If value or points are omitted in playerResults, they will be summed from stage results
 */
export function computeGroupResult(
    simpleResult: SimpleGroupResult,
    higherPointsBetter: boolean,
    stageResults?: GroupResult[]
): GroupResult {
    // If playerResults not provided, aggregate from stage results
    let simplePlayerResults = simpleResult.playerResults;
    if (!simplePlayerResults) {
        if (!stageResults || stageResults.length === 0) {
            return {
                playerResults: {},
                winners: [],
                winningPoints: 0,
                stats: simpleResult.stats,
            };
        }
        const aggregated = aggregateStageResults(stageResults);
        simplePlayerResults = aggregated.playerResults || {};
        // Merge stats
        simpleResult.stats = {
            ...aggregated.stats,
            ...simpleResult.stats,
        };
    } else if (stageResults && stageResults.length > 0) {
        // playerResults provided, but may have omitted value/points - fill them in from stage results
        const aggregated = aggregateStageResults(stageResults);
        const aggregatedPlayerResults = aggregated.playerResults || {};

        // For each player in simplePlayerResults, fill in missing value/points from aggregated
        for (const playerId of Object.keys(simplePlayerResults)) {
            const simple = simplePlayerResults[playerId];
            const aggregatedResult = aggregatedPlayerResults[playerId];

            if (aggregatedResult) {
                // If value is omitted (undefined), use sum from stage results
                if (simple.value === undefined) {
                    simple.value = aggregatedResult.value;
                }
                // If points is omitted (undefined), use sum from stage results
                if (simple.points === undefined) {
                    simple.points = aggregatedResult.points;
                }
            }
        }

        // Also include any players that are in aggregated but not in simplePlayerResults
        for (const playerId of Object.keys(aggregatedPlayerResults)) {
            if (!simplePlayerResults[playerId]) {
                simplePlayerResults[playerId] = aggregatedPlayerResults[playerId];
            }
        }

        // Merge stats
        simpleResult.stats = {
            ...aggregated.stats,
            ...simpleResult.stats,
        };
    }

    const playerIds = Object.keys(simplePlayerResults);

    if (playerIds.length === 0) {
        return {
            playerResults: {},
            winners: [],
            winningPoints: 0,
            stats: simpleResult.stats,
        };
    }

    // Extract points for ranking
    // If value is null/undefined, points must also be null/undefined
    // If points is not specified, use value (must be a number)
    const pointsMap: Record<PlayerId, number | null> = {};
    for (const playerId of playerIds) {
        const simple = simplePlayerResults[playerId];

        // If value is null/undefined, points must also be null/undefined
        if (simple.value === null || simple.value === undefined) {
            if (simple.points !== null && simple.points !== undefined) {
                throw new Error(
                    `Value is null/undefined for player ${playerId}, but points is specified. ` +
                    `Points must be null/undefined when value is null/undefined. ` +
                    `Points: ${JSON.stringify(simple.points)}.`
                );
            }
            pointsMap[playerId] = null;
            continue;
        }

        // Value is not null/undefined - determine points
        if (simple.points !== undefined && simple.points !== null) {
            pointsMap[playerId] = simple.points;
        } else {
            // Points not specified - use value, but value must be a number
            if (typeof simple.value !== 'number') {
                throw new Error(
                    `Points not specified for player ${playerId} and value is not a number. ` +
                    `Value: ${JSON.stringify(simple.value)}. ` +
                    `Either specify points or ensure value is a number.`
                );
            }
            pointsMap[playerId] = simple.value;
        }
    }

    // Rank by points (higher or lower depending on higherPointsBetter)
    const ranks = higherPointsBetter
        ? rankByHighest(pointsMap)
        : rankByLowest(pointsMap);

    // Build full player results
    const playerResults: Record<PlayerId, PlayerResult> = {};
    for (const playerId of playerIds) {
        const simple = simplePlayerResults[playerId];
        const place = ranks[playerId];
        const placeFromEnd = calculatePlaceFromEnd(place, playerIds.length);
        const won = place === 1;
        const lost = place === playerIds.length; // Last place

        // Determine points: use specified points, or value if it's a number
        // If value is null/undefined, points must also be null/undefined
        let points: number | null;
        if (simple.value === null || simple.value === undefined) {
            if (simple.points !== null && simple.points !== undefined) {
                throw new Error(
                    `Value is null/undefined for player ${playerId}, but points is specified. ` +
                    `Points must be null/undefined when value is null/undefined. ` +
                    `Points: ${JSON.stringify(simple.points)}.`
                );
            }
            points = null;
        } else if (simple.points !== undefined && simple.points !== null) {
            points = simple.points;
        } else {
            // Points not specified - use value, but value must be a number
            if (typeof simple.value !== 'number') {
                throw new Error(
                    `Points not specified for player ${playerId} and value is not a number. ` +
                    `Value: ${JSON.stringify(simple.value)}. ` +
                    `Either specify points or ensure value is a number.`
                );
            }
            points = simple.value;
        }

        playerResults[playerId] = {
            value: simple.value,
            place,
            placeFromEnd,
            points,
            won,
            lost,
            scoreType: simple.scoreType,
            stats: simple.stats,
        };
    }

    // Determine winners and winning points
    const winners = getWinners(playerResults);
    const winningPoints = winners.length > 0 && playerResults[winners[0]].points !== null
        ? playerResults[winners[0]].points!
        : 0;

    // Auto-compute averagePoints, averageValue, totalPlayers and add to stats
    let totalValue = 0;
    let totalPoints = 0;
    let valueCount = 0;
    let pointsCount = 0;

    for (const result of Object.values(playerResults)) {
        if (result.value !== null && result.value !== undefined && typeof result.value === 'number') {
            totalValue += result.value;
            valueCount++;
        }
        if (result.points !== null && result.points !== undefined && typeof result.points === 'number') {
            totalPoints += result.points;
            pointsCount++;
        }
    }

    const averageValue = valueCount > 0 ? totalValue / valueCount : null;
    const averagePoints = pointsCount > 0 ? totalPoints / pointsCount : null;
    const totalPlayers = Object.keys(playerResults).length;

    // Merge auto-computed stats with provided stats
    const finalStats = {
        ...simpleResult.stats,
        totalPlayers,
        averageValue,
        averagePoints,
    };

    return {
        playerResults,
        winners,
        winningPoints,
        stats: finalStats,
    };
}

/**
 * Precompute stats from player values
 * Computes totalPlayers, averageValue, and averagePoints
 */
export function precomputeStageStats(
    playerValues: PlayerValues,
    valueToPoints?: ValueToPoints
): {
    totalPlayers: number;
    averageValue: number | null;
    averagePoints: number | null;
} {
    const playerIds = Object.keys(playerValues);
    const totalPlayers = playerIds.length;

    if (totalPlayers === 0) {
        return {
            totalPlayers: 0,
            averageValue: null,
            averagePoints: null,
        };
    }

    let totalValue = 0;
    let totalPoints = 0;
    let valueCount = 0;
    let pointsCount = 0;

    // Default valueToPoints is identity function
    const convertToPoints = valueToPoints || ((v: Value) => {
        if (typeof v === 'number') {
            return v;
        }
        return null;
    });

    for (const playerId of playerIds) {
        const value = playerValues[playerId];
        
        if (value !== null && value !== undefined && typeof value === 'number') {
            totalValue += value;
            valueCount++;
        }

        const points = convertToPoints(value);
        if (points !== null && points !== undefined && typeof points === 'number') {
            totalPoints += points;
            pointsCount++;
        }
    }

    const averageValue = valueCount > 0 ? totalValue / valueCount : null;
    const averagePoints = pointsCount > 0 ? totalPoints / pointsCount : null;

    return {
        totalPlayers,
        averageValue,
        averagePoints,
    };
}

/**
 * Default implementation for scoring a stage
 * Used when scoringMethod.scoreStage is not provided
 */
export function defaultScoreStage(
    scoringMethod: ScoringMethod,
    stageInfo: StageScoringInfo
): SimpleGroupResult {
    const { playerValues, precomputedStats } = stageInfo;
    const playerIds = Object.keys(playerValues);

    // Default valueToPoints is identity function
    const convertToPoints = scoringMethod.valueToPoints || ((v: Value) => {
        if (typeof v === 'number') {
            return v;
        }
        return null;
    });

    // Default valueToScoreType returns empty string
    const getScoreType = scoringMethod.valueToScoreType || (() => '');

    const playerResults: Record<PlayerId, SimplePlayerResult> = {};

    for (const playerId of playerIds) {
        const value = playerValues[playerId];
        const points = convertToPoints(value);
        const scoreType = getScoreType(value, stageInfo.stageInfo);

        playerResults[playerId] = {
            value: value ?? null,
            points: points ?? null,
            scoreType,
            stats: {},
        };
    }

    return {
        playerResults,
        stats: {
            ...precomputedStats,
        },
    };
}

/**
 * Recompute stats from a SimpleGroupResult
 * Extracts stats from playerResults (totalPlayers, averageValue, averagePoints)
 */
export function recomputeStatsFromResult(
    simpleResult: SimpleGroupResult
): {
    totalPlayers: number;
    averageValue: number | null;
    averagePoints: number | null;
} {
    const playerResults = simpleResult.playerResults || {};
    const playerIds = Object.keys(playerResults);

    if (playerIds.length === 0) {
        return {
            totalPlayers: 0,
            averageValue: null,
            averagePoints: null,
        };
    }

    let totalValue = 0;
    let totalPoints = 0;
    let valueCount = 0;
    let pointsCount = 0;

    for (const playerId of playerIds) {
        const result = playerResults[playerId];
        
        if (result.value !== null && result.value !== undefined && typeof result.value === 'number') {
            totalValue += result.value;
            valueCount++;
        }

        if (result.points !== null && result.points !== undefined && typeof result.points === 'number') {
            totalPoints += result.points;
            pointsCount++;
        }
    }

    const averageValue = valueCount > 0 ? totalValue / valueCount : null;
    const averagePoints = pointsCount > 0 ? totalPoints / pointsCount : null;

    return {
        totalPlayers: playerIds.length,
        averageValue,
        averagePoints,
    };
}

