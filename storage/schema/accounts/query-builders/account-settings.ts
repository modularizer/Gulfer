/**
 * Account Settings Query Builder
 * 
 * Query builder for account settings.
 * Handles querying account settings with their setting option definitions.
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { Database } from '../../../adapters';
import * as schema from '../schema/tables';
import { applyQueryModifiers, type QueryBuilderState } from '../../generic-sports-data/query-builders/base';
import type {
  Account,
  SettingOption,
  AccountSettingOption,
  AccountSettingOptionInsert,
} from '../schema/tables';

// ============================================================================
// Meta-Types: Raw Drizzle Join Result Types (camelCase)
// ============================================================================

/**
 * Account settings join result
 */
export type AccountSettingsJoin = {
  accounts: Account | null;
  accountSettingOptions: AccountSettingOption | null;
  settingOptions: SettingOption | null;
};

// ============================================================================
// Result Types: Grouped/Denormalized Structures
// ============================================================================

/**
 * Account with all settings
 */
export type AccountWithSettings = {
  account: Account;
  settings: {
    settingOption: SettingOption;
    value: any;
    updatedAt: Date | null;
  }[];
};

/**
 * Setting option with all account values
 */
export type SettingOptionWithAccountValues = {
  settingOption: SettingOption;
  accountValues: {
    accountId: string;
    value: any;
    updatedAt: Date | null;
  }[];
};

// ============================================================================
// Query Builder
// ============================================================================

type JoinFlags = {
  settingOptions: boolean;
};

type AccountSettingsBuilder<F extends JoinFlags = JoinFlags> = {
  forAccount(accountId: string): AccountSettingsBuilder<F>;
  forSettingOption(settingOptionId: string): AccountSettingsBuilder<F>;
  withSettingOptions(): AccountSettingsBuilder<F & { settingOptions: true }>;
  where(condition: SQL): AccountSettingsBuilder<F>;
  limit(n: number): AccountSettingsBuilder<F>;
  offset(n: number): AccountSettingsBuilder<F>;
  execute(): Promise<AccountWithSettings[]>;
  executeForSettingOption(): Promise<SettingOptionWithAccountValues[]>;
  // Meta-type accessor
  $metaType: AccountSettingsJoin;
};

/**
 * Start building an account settings query
 */
export function queryAccountSettings(db: Database): AccountSettingsBuilder<{
  settingOptions: false;
}> {
  let selectQuery: any = null;
  let queryType: 'account' | 'settingOption' | null = null;
  let queryId: string | null = null;
  
  const flags: JoinFlags = {
    settingOptions: false,
  };
  const state: QueryBuilderState = {};
  
  const createBuilder = <F extends JoinFlags>(): AccountSettingsBuilder<F> => ({
    forAccount(accountId: string) {
      queryType = 'account';
      queryId = accountId;
      selectQuery = db.select()
        .from(schema.accountSettingOptions)
        .leftJoin(schema.accounts, eq(schema.accountSettingOptions.accountId, schema.accounts.id))
        .leftJoin(schema.settingOptions, eq(schema.accountSettingOptions.settingOptionId, schema.settingOptions.id))
        .where(eq(schema.accountSettingOptions.accountId, accountId));
      return createBuilder<F>() as any;
    },
    
    forSettingOption(settingOptionId: string) {
      queryType = 'settingOption';
      queryId = settingOptionId;
      selectQuery = db.select()
        .from(schema.accountSettingOptions)
        .leftJoin(schema.accounts, eq(schema.accountSettingOptions.accountId, schema.accounts.id))
        .leftJoin(schema.settingOptions, eq(schema.accountSettingOptions.settingOptionId, schema.settingOptions.id))
        .where(eq(schema.accountSettingOptions.settingOptionId, settingOptionId));
      return createBuilder<F>() as any;
    },
    
    withSettingOptions() {
      // Already joined in base query
      flags.settingOptions = true;
      return createBuilder<F & { settingOptions: true }>() as any;
    },
    
    where(condition: SQL) {
      state.whereCondition = condition;
      return createBuilder<F>();
    },
    
    limit(n: number) {
      state.limitValue = n;
      return createBuilder<F>();
    },
    
    offset(n: number) {
      state.offsetValue = n;
      return createBuilder<F>();
    },
    
    async execute(): Promise<AccountWithSettings[]> {
      if (!selectQuery || queryType !== 'account') {
        throw new Error('Must specify forAccount before executing');
      }
      
      // Apply where, limit, offset
      selectQuery = applyQueryModifiers(
        selectQuery,
        state,
        (q, cond) => q.where(cond),
        (q, n) => q.limit(n),
        (q, n) => q.offset(n)
      );
      
      const results = await selectQuery;
      
      // Group by account
      const accountMap = new Map<string, AccountWithSettings>();
      
      for (const row of results as any) {
        const accountId = row.account_setting_options?.account_id || row.accounts?.id;
        if (!accountId) continue;
        
        if (!accountMap.has(accountId)) {
          accountMap.set(accountId, {
            account: row.accounts || null,
            settings: [],
          });
        }
        
        const accountData = accountMap.get(accountId)!;
        
        if (row.setting_options && row.account_setting_options) {
          accountData.settings.push({
            settingOption: row.setting_options,
            value: row.account_setting_options.value,
            updatedAt: row.account_setting_options.updated_at,
          });
        }
      }
      
      return Array.from(accountMap.values());
    },
    
    async executeForSettingOption(): Promise<SettingOptionWithAccountValues[]> {
      if (!selectQuery || queryType !== 'settingOption') {
        throw new Error('Must specify forSettingOption before executing');
      }
      
      // Apply where, limit, offset
      selectQuery = applyQueryModifiers(
        selectQuery,
        state,
        (q, cond) => q.where(cond),
        (q, n) => q.limit(n),
        (q, n) => q.offset(n)
      );
      
      const results = await selectQuery;
      
      // Group by setting option
      const settingOptionMap = new Map<string, SettingOptionWithAccountValues>();
      
      for (const row of results as any) {
        const settingOptionId = row.setting_options?.id || row.account_setting_options?.setting_option_id;
        if (!settingOptionId) continue;
        
        if (!settingOptionMap.has(settingOptionId)) {
          settingOptionMap.set(settingOptionId, {
            settingOption: row.setting_options || null,
            accountValues: [],
          });
        }
        
        const settingData = settingOptionMap.get(settingOptionId)!;
        
        if (row.account_setting_options?.account_id) {
          settingData.accountValues.push({
            accountId: row.account_setting_options.account_id,
            value: row.account_setting_options.value,
            updatedAt: row.account_setting_options.updated_at,
          });
        }
      }
      
      return Array.from(settingOptionMap.values());
    },
    
    $metaType: null as any as AccountSettingsJoin,
  } as AccountSettingsBuilder<F>);
  
  return createBuilder();
}

// ============================================================================
// Upsert Functions
// ============================================================================

/**
 * Upsert account settings
 */
export async function upsertAccountSettings(
  db: Database,
  accountId: string,
  settings: Array<{
    settingOptionId: string;
    value: any;
  }>
): Promise<void> {
  for (const setting of settings) {
    // Check if setting already exists
    const existing = await db
      .select()
      .from(schema.accountSettingOptions)
      .where(
        and(
          eq(schema.accountSettingOptions.accountId, accountId),
          eq(schema.accountSettingOptions.settingOptionId, setting.settingOptionId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(schema.accountSettingOptions)
        .set({
          value: setting.value,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.accountSettingOptions.accountId, accountId),
            eq(schema.accountSettingOptions.settingOptionId, setting.settingOptionId)
          )
        );
    } else {
      // Insert new
      await db.insert(schema.accountSettingOptions).values({
        accountId,
        settingOptionId: setting.settingOptionId,
        value: setting.value,
        updatedAt: new Date(),
      } as Partial<AccountSettingOptionInsert>);
    }
  }
}

