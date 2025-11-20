/**
 * Account Schema Type Definitions
 * 
 * Centralized definitions of all inferred types from the account generic-sports tables.
 */

import * as schema from './index';

// ============================================================================
// Accounts
// ============================================================================

export type Account = typeof schema.accounts.$inferSelect;
export type AccountInsert = typeof schema.accounts.$inferInsert;

// ============================================================================
// Settings
// ============================================================================

export type SettingOption = typeof schema.settingOptions.$inferSelect;
export type SettingOptionInsert = typeof schema.settingOptions.$inferInsert;

export type AccountSettingOption = typeof schema.accountSettingOptions.$inferSelect;
export type AccountSettingOptionInsert = typeof schema.accountSettingOptions.$inferInsert;

