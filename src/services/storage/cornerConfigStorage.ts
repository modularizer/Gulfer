/**
 * Storage service for corner statistics configuration
 * Uses Drizzle ORM directly - stores in settings table
 */
import { CornerStatisticsConfig } from '../cornerStatistics';
import { getSettings, updateSettings } from './settingsHelper';



/**
 * Get the saved column visibility configuration
 */
export async function getColumnVisibility(): Promise<ColumnVisibilityConfig | null> {
  const settings = await getSettings();
  
  if (settings.columnVisibility) {
    return settings.columnVisibility as ColumnVisibilityConfig;
  }
  
  // Default: show distance and g-stats, hide par
  return { distance: true, par: false, gStats: true };
}

/**
 * Save the column visibility configuration
 */
export async function saveColumnVisibility(config: ColumnVisibilityConfig): Promise<void> {
  await updateSettings({ columnVisibility: config });
}

/**
 * Get the saved corner statistics configuration
 */
export async function getCornerConfig(): Promise<CornerStatisticsConfig | null> {
  const settings = await getSettings();
  
  if (settings.cornerConfig) {
    return settings.cornerConfig as CornerStatisticsConfig;
  }
  return null;
}

/**
 * Save the corner statistics configuration
 */
export async function saveCornerConfig(config: CornerStatisticsConfig): Promise<void> {
  await updateSettings({ cornerConfig: config });
}
