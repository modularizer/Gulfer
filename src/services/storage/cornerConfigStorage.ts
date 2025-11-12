/**
 * Storage service for corner statistics configuration
 */

import { defaultStorageDriver } from './drivers';
import { CornerStatisticsConfig } from '../cornerStatistics';

const CORNER_CONFIG_STORAGE_KEY = '@gulfer_corner_config';
const COLUMN_VISIBILITY_STORAGE_KEY = '@gulfer_column_visibility';

export interface ColumnVisibilityConfig {
  distance?: boolean;
  par?: boolean;
  gStats?: boolean;    // G-Stats column (worst/25th/50th/75th/best)
  showUnderlines?: boolean; // Show winner/loser underlines on scores
  showFontSizeAdjustments?: boolean; // Adjust font size for wins (+3) and losses (-3)
  showFontColorAdjustments?: boolean; // Adjust font color for wins/losses/ties
  [key: string]: boolean | undefined; // Allow for future columns
}

/**
 * Get the saved column visibility configuration
 */
export async function getColumnVisibility(): Promise<ColumnVisibilityConfig | null> {
  try {
    const data = await defaultStorageDriver.getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Default: show distance and g-stats, hide par (if it exists)
    return { distance: true, par: false, gStats: true };
  } catch (error) {
    console.error('Error loading column visibility:', error);
    return { distance: true, par: false, gStats: true };
  }
}

/**
 * Save the column visibility configuration
 */
export async function saveColumnVisibility(config: ColumnVisibilityConfig): Promise<void> {
  try {
    await defaultStorageDriver.setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving column visibility:', error);
    throw error;
  }
}

/**
 * Get the saved corner statistics configuration
 */
export async function getCornerConfig(): Promise<CornerStatisticsConfig | null> {
  try {
    const data = await defaultStorageDriver.getItem(CORNER_CONFIG_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Error loading corner config:', error);
    return null;
  }
}

/**
 * Save the corner statistics configuration
 */
export async function saveCornerConfig(config: CornerStatisticsConfig): Promise<void> {
  try {
    await defaultStorageDriver.setItem(CORNER_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving corner config:', error);
    throw error;
  }
}

