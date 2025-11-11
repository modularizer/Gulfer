/**
 * Storage service for corner statistics configuration
 */

import { getItem, setItem } from './storageAdapter';
import { CornerStatisticsConfig } from '../cornerStatistics';

const CORNER_CONFIG_STORAGE_KEY = '@gulfer_corner_config';
const COLUMN_VISIBILITY_STORAGE_KEY = '@gulfer_column_visibility';

export interface ColumnVisibilityConfig {
  distance?: boolean;
  par?: boolean;
  [key: string]: boolean | undefined; // Allow for future columns
}

/**
 * Get the saved column visibility configuration
 */
export async function getColumnVisibility(): Promise<ColumnVisibilityConfig | null> {
  try {
    const data = await getItem(COLUMN_VISIBILITY_STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
    // Default: show distance, hide par (if it exists)
    return { distance: true, par: false };
  } catch (error) {
    console.error('Error loading column visibility:', error);
    return { distance: true, par: false };
  }
}

/**
 * Save the column visibility configuration
 */
export async function saveColumnVisibility(config: ColumnVisibilityConfig): Promise<void> {
  try {
    await setItem(COLUMN_VISIBILITY_STORAGE_KEY, JSON.stringify(config));
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
    const data = await getItem(CORNER_CONFIG_STORAGE_KEY);
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
    await setItem(CORNER_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Error saving corner config:', error);
    throw error;
  }
}

