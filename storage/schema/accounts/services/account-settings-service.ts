/**
 * Account Settings Service
 * 
 * Object-oriented service for managing account settings.
 * Handles registering setting options and managing account-specific setting values.
 */

import { BaseService } from '../../generic-sports-data/services/base';
import type { Database } from '../../../../xp-deeby/adapters';
import { eq, and } from 'drizzle-orm';
import * as schema from '../schema/tables';
import type { SettingOption, SettingOptionInsert, AccountSettingOption } from '../schema/tables';
import { queryAccountSettings, upsertAccountSettings } from '../query-builders';
import type { AccountWithSettings, SettingOptionWithAccountValues } from '../query-builders';
import { generateUUID } from '../../../../xp-deeby/utils';

import { z } from 'zod';

/**
 * Setting option specification using Zod
 * Defines the structure and validation for a setting
 */
export type SettingSpec = z.ZodTypeAny;

export class AccountSettingsService extends BaseService {
  /**
   * Register a new setting option
   * This defines a setting that can be used across all accounts
   */
  async registerSettingOption(
    name: string,
    spec: SettingSpec
  ): Promise<SettingOption> {
    // Check if setting already exists
    const existing = await this.db
      .select()
      .from(schema.settingOptions)
      .where(eq(schema.settingOptions.name, name))
      .limit(1);

    if (existing.length > 0) {
      // Update existing setting
      const updated: Partial<SettingOptionInsert> = {
        ...existing[0],
        spec,
      };
      schema.settingOptions.using(this.db).upsertWhere(spec, 'name')
      await upsertEntity(this.db, schema.settingOptions, updated);
      return updated as SettingOption;
    }

    // Create new setting
    const settingOption: Partial<SettingOptionInsert> = {
      id: generateUUID(),
      name,
      spec,
    };

    await upsertEntity(this.db, schema.settingOptions, settingOption);

    const saved = await this.db
      .select()
      .from(schema.settingOptions)
      .where(eq(schema.settingOptions.id, settingOption.id!))
      .limit(1);

    if (saved.length === 0) {
      throw new Error('Failed to register setting option');
    }

    return saved[0] as SettingOption;
  }

  /**
   * Get a setting option by name
   */
  async getSettingOption(name: string): Promise<SettingOption | null> {
    const results = await this.db
      .select()
      .from(schema.settingOptions)
      .where(eq(schema.settingOptions.name, name))
      .limit(1);

    return results.length > 0 ? (results[0] as SettingOption) : null;
  }

  /**
   * Get a setting option by ID
   */
  async getSettingOptionById(settingOptionId: string): Promise<SettingOption | null> {
    return await this.getById<SettingOption>(schema.settingOptions, settingOptionId);
  }

  /**
   * Get all setting options
   */
  async getAllSettingOptions(): Promise<SettingOption[]> {
    return await this.getAll<SettingOption>(schema.settingOptions);
  }

  /**
   * Get account settings
   */
  async getAccountSettings(accountId: string): Promise<AccountWithSettings | null> {
    const results = await queryAccountSettings(this.db)
      .forAccount(accountId)
      .withSettingOptions()
      .execute();

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Set a setting value for an account
   */
  async setAccountSetting(
    accountId: string,
    settingOptionId: string,
    value: any
  ): Promise<void> {
    // Verify setting option exists
    const settingOption = await this.getSettingOptionById(settingOptionId);
    if (!settingOption) {
      throw new Error(`Setting option not found: ${settingOptionId}`);
    }

    // Validate value against spec if provided
    // Note: Full Zod validation would require storing the generic-sports in a way that can be reconstructed
    // For now, validation is handled at the application level when schemas are registered

    await upsertAccountSettings(this.db, accountId, [
      {
        settingOptionId,
        value,
      },
    ]);
  }

  /**
   * Set multiple setting values for an account
   */
  async setAccountSettings(
    accountId: string,
    settings: Array<{
      settingOptionId: string;
      value: any;
    }>
  ): Promise<void> {
    // Validate all settings
    for (const setting of settings) {
      const settingOption = await this.getSettingOptionById(setting.settingOptionId);
      if (!settingOption) {
        throw new Error(`Setting option not found: ${setting.settingOptionId}`);
      }

      // Validate value against spec if provided
      // Note: Full Zod validation would require storing the generic-sports in a way that can be reconstructed
    }

    await upsertAccountSettings(this.db, accountId, settings);
  }

  /**
   * Get a setting value for an account
   */
  async getAccountSetting(
    accountId: string,
    settingOptionId: string
  ): Promise<any | null> {
    const results = await this.db
      .select()
      .from(schema.accountSettingOptions)
      .where(
        and(
          eq(schema.accountSettingOptions.accountId, accountId),
          eq(schema.accountSettingOptions.settingOptionId, settingOptionId)
        )
      )
      .limit(1);

    if (results.length === 0) {
      // Return null if not set (defaults would be handled by the Zod generic-sports)
      return null;
    }

    return (results[0] as AccountSettingOption).value;
  }

  /**
   * Get setting values for a setting option across all accounts
   */
  async getSettingOptionValues(settingOptionId: string): Promise<SettingOptionWithAccountValues | null> {
    const results = await queryAccountSettings(this.db)
      .forSettingOption(settingOptionId)
      .withSettingOptions()
      .executeForSettingOption();

    return results.length > 0 ? results[0] : null;
  }

  /**
   * Delete an account setting
   */
  async deleteAccountSetting(
    accountId: string,
    settingOptionId: string
  ): Promise<void> {
    await this.db
      .delete(schema.accountSettingOptions)
      .where(
        and(
          eq(schema.accountSettingOptions.accountId, accountId),
          eq(schema.accountSettingOptions.settingOptionId, settingOptionId)
        )
      );
  }

  /**
   * Delete all settings for an account
   */
  async deleteAllAccountSettings(accountId: string): Promise<void> {
    await this.db
      .delete(schema.accountSettingOptions)
      .where(eq(schema.accountSettingOptions.accountId, accountId));
  }

  /**
   * Validate a setting value against its Zod generic-sports
   * Note: This requires the generic-sports to be stored in a way that can be reconstructed
   * For now, this is a placeholder for future implementation
   */
  private validateSettingValue(value: any, schema: SettingSpec): void {
    try {
      schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Invalid setting value: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        );
      }
      throw error;
    }
  }
}

