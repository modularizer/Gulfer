/**
 * Accounts Schema
 * 
 * This schema wraps all accounts tables using xpschema.
 * Use schema.gen() to generate types, create scripts, and migrations.
 */

import { xpschema } from '../../../xp-deeby/xp-schema';
import * as tables from './schema/tables';

export const schema = xpschema({
    accounts: tables.accounts,
    settingOptions: tables.settingOptions,
    accountSettingOptions: tables.accountSettingOptions,
}, __filename);

