/**
 * Service for computing corner statistics from round data
 * Refactored to use playerRounds (playerRounds) directly from database
 */


/**
 * Enum for user filter options
 */
export enum UserFilterEnum {
    /** Include all rounds from everyone */
    Everyone = 'everyone',
    /** Each player's column uses their own rounds (each respective player) */
    EachUser = 'eachUser',
    /** Players from today's round */
    TodaysPlayers = 'todaysPlayers',
}

/**
 * Filter for which users' data to include
 * - UserFilterEnum: Include all rounds from everyone, each user, or today's players
 * - string[]: Array of user IDs - compare each player against these users' rounds
 */
export type UserFilter =
    | UserFilterEnum
    | string[];

/**
 * Enum for accumulation modes - how to combine multiple scores
 */
export enum AccumulationModeEnum {
    /** Use the best (lowest) score */
    Best = 'best',
    /** Use the latest (most recent) score */
    Latest = 'latest',
    /** Use the first (earliest) score */
    First = 'first',
    /** Use the worst (highest) score */
    Worst = 'worst',
    /** Use the average of all scores */
    Average = 'average',
    /** Use a percentile of all scores */
    Percentile = 'percentile',
    /** Use the relevant score (one round per player) */
    Relevant = 'relevant',
}

/**
 * How to accumulate multiple scores into a single value
 */
export type AccumulationMode = AccumulationModeEnum;

/**
 * Enum for the scope of the statistic
 */
export enum ScopeEnum {
    /** Statistic applies to the entire round */
    Round = 'round',
    /** Statistic applies to a single hole */
    Hole = 'hole',
}

/**
 * The scope of the statistic (round or hole level)
 */
export type Scope = ScopeEnum;

/**
 * Enum for round selection criteria
 */
export enum RoundSelectionEnum {
    /** Include all rounds */
    All = 'all',
    /** Include only the latest round */
    Latest = 'latest',
    /** Include the 2nd latest round */
    Latest2 = 'latest2',
    /** Include the 3rd latest round */
    Latest3 = 'latest3',
    /** Include only the first round */
    First = 'first',
    /** Include only the best (lowest total score) round */
    BestRound = 'bestRound',
    /** Include the 2nd best round */
    BestRound2 = 'bestRound2',
    /** Include the 2 best rounds */
    BestRounds2 = 'bestRounds2',
    /** Include the 3 best rounds */
    BestRounds3 = 'bestRounds3',
    /** Include only the worst (highest total score) round */
    WorstRound = 'worstRound',
    /** Include the 2nd worst round */
    WorstRound2 = 'worstRound2',
    /** Include the 2 worst rounds */
    WorstRounds2 = 'worstRounds2',
    /** Include the 3 worst rounds */
    WorstRounds3 = 'worstRounds3',
}

/**
 * Enum for round selection type (used in object-based selections)
 */
export enum RoundSelectionTypeEnum {
    /** Select specific rounds by their IDs */
    Specific = 'specific',
    /** Custom date option */
    Custom = 'custom',
}

/**
 * Selection criteria for which rounds to include
 * - RoundSelectionEnum: Predefined selection (all, latest, first, best/worst rounds, etc.)
 * - Object with type RoundSelectionTypeEnum.Specific: Specific round IDs to include
 */
export type RoundSelection =
    | RoundSelectionEnum
    | { type: RoundSelectionTypeEnum.Specific; roundIds: string[] };

/**
 * Enum for user filter mode when multiple users are selected
 */
export enum UserFilterModeEnum {
    /** All users must be present in the round */
    And = 'and',
    /** Any user can be present in the round */
    Or = 'or',
}

/**
 * For multiple user selection: UserFilterModeEnum.And = all users must be in round, UserFilterModeEnum.Or = any user can be in round
 */
export type UserFilterMode = UserFilterModeEnum;

/**
 * Enum for "since date" options
 */
export enum SinceDateOptionEnum {
    /** From the beginning of time */
    Beginning = 'beginning',
    /** From one year ago */
    YearAgo = 'yearAgo',
    /** From one month ago */
    MonthAgo = 'monthAgo',
}

/**
 * Enum for "until date" options
 */
export enum UntilDateOptionEnum {
    /** Until today (end of day) */
    Today = 'today',
    /** Until yesterday (end of day) */
    Yesterday = 'yesterday',
}

/**
 * Date option for filtering rounds from a starting date
 * - SinceDateOptionEnum: Predefined options (beginning, yearAgo, monthAgo)
 * - Object with type RoundSelectionTypeEnum.Custom: Custom timestamp
 */
export type SinceDateOption = SinceDateOptionEnum | { type: RoundSelectionTypeEnum.Custom; timestamp: number };

/**
 * Date option for filtering rounds until an ending date
 * - UntilDateOptionEnum: Predefined options (today, yesterday)
 * - Object with type RoundSelectionTypeEnum.Custom: Custom timestamp
 */
export type UntilDateOption = UntilDateOptionEnum | { type: RoundSelectionTypeEnum.Custom; timestamp: number };

/**
 * Configuration for a single corner statistic
 */
export interface CornerConfig {
    /** Which users' scores to consider from the filtered rounds */
    scoreUserFilter: UserFilter;
    /** Which rounds to include based on who played in them */
    roundUserFilter: UserFilter;
    /** Used when either scoreUserFilter or roundUserFilter is an array with multiple users (UserFilterModeEnum.And = all users must be present, UserFilterModeEnum.Or = any user can be present) */
    userFilterMode?: UserFilterMode;
    /** How to accumulate the scores (best, worst, average, latest, first, percentile, or relevant) */
    accumulationMode: AccumulationMode;
    /** The scope of the statistic (round or hole) */
    scope: Scope;
    /** Required if accumulationMode is not AccumulationModeEnum.Latest or AccumulationModeEnum.First */
    roundSelection?: RoundSelection;
    /** Required if accumulationMode is AccumulationModeEnum.Percentile (0-100) */
    percentile?: number;
    /** Optional: filter rounds to those on or after this date */
    sinceDate?: SinceDateOption;
    /** Optional: filter rounds to those on or before this date */
    untilDate?: UntilDateOption;
    /** Optional: name of the preset that was used to create this config */
    presetName?: string;
    /** Optional: if true, automatically color the corner based on comparison with cell value (red if corner < cell, yellow/orange if equal, green if corner > cell) */
    autoColor?: boolean;
    /** Optional: custom hex color for the corner (only used if autoColor is not true) */
    customColor?: string;
}

/**
 * Configuration for all four corner statistics (top-left, top-right, bottom-left, bottom-right)
 */
export interface CornerStatisticsConfig {
    /** Configuration for the top-left corner */
    topLeft?: CornerConfig | null;
    /** Configuration for the top-right corner */
    topRight?: CornerConfig | null;
    /** Configuration for the bottom-left corner */
    bottomLeft?: CornerConfig | null;
    /** Configuration for the bottom-right corner */
    bottomRight?: CornerConfig | null;
}