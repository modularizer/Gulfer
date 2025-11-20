import {
    table, text, integer, real, timestamp, jsonb, unique, index, bool, uuid, uuidPK, uuidDefault
} from '../../../../../xp-deeby/xp-schema';
import {accounts} from "./accounts";



export const settingOptions = table('setting_options', {
    id: uuidPK('id'),
    name: text('name'),
    spec: jsonb('spec'),
})


export const accountSettingOptions = table('account_setting_options', {
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    settingOptionId: uuid('setting_option_id').references(() => settingOptions.id, { onDelete: 'cascade' }),
    value: jsonb('value'),
    updatedAt: timestamp('updated_at'),
})

