/**
 * Type definitions for JSON columns in the Drizzle schema
 * These types are used with text(columnName, { mode: 'json' }).$type<>() in schema definitions
 * Note: SQLite doesn't have a native JSON type, so we use text columns with JSON mode
 */

import type { CardMode } from '@/components/common/CardModeToggle';
import type { ColumnVisibilityConfig } from '@/types/schema';
import type { CornerStatisticsConfig } from '@/services/cornerStatistics';
import type { NavigationState, ModalState } from '@/services/navigationState';

/**
 * Card modes configuration
 * Maps page names to their card display modes
 */
export type CardModes = Record<string, CardMode>;

/**
 * Column visibility configuration
 * Re-exported from types/schema for consistency
 */
export type { ColumnVisibilityConfig };

/**
 * Corner statistics configuration
 * Re-exported from services/cornerStatistics for consistency
 */
export type { CornerStatisticsConfig };

/**
 * Navigation state
 * Re-exported from services/navigationState for consistency
 */
export type { NavigationState };

/**
 * Modal states configuration
 * Maps route paths to their modal state objects
 */
export type ModalStates = Record<string, ModalState>;

/**
 * Settings other field
 * Generic key-value store for miscellaneous settings
 */
export type SettingsOther = Record<string, any>;

