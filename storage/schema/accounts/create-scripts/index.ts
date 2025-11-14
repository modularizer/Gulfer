/**
 * Re-Runnable CREATE Scripts for Accounts
 * Auto-generated - do not edit manually
 * 
 * Contains CREATE IF NOT EXISTS scripts for all supported dialects.
 * These scripts are idempotent and can be run multiple times safely.
 */

export const createScripts = {
  sqlite: {
    hash: '7d8dadbff758c9ed',
    sql: "CREATE TABLE IF NOT EXISTS \"accounts\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"participant_id\" text,\n\t\"deleted_at\" integer,\n\tFOREIGN KEY (\"participant_id\") REFERENCES \"participants\"(\"id\") ON UPDATE no action ON DELETE cascade\n);\nCREATE TABLE IF NOT EXISTS \"account_setting_options\" (\n\t\"account_id\" text,\n\t\"setting_option_id\" text,\n\t\"value\" text,\n\t\"updated_at\" integer,\n\tFOREIGN KEY (\"account_id\") REFERENCES \"accounts\"(\"id\") ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (\"setting_option_id\") REFERENCES \"setting_options\"(\"id\") ON UPDATE no action ON DELETE cascade\n);\nCREATE TABLE IF NOT EXISTS \"setting_options\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"name\" text,\n\t\"spec\" text\n);",
  },
  postgres: {
    hash: '7d8dadbff758c9ed',
    sql: "CREATE TABLE IF NOT EXISTS \"accounts\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"participant_id\" text,\n\t\"deleted_at\" integer,\n\tFOREIGN KEY (\"participant_id\") REFERENCES \"participants\"(\"id\") ON UPDATE no action ON DELETE cascade\n);\nCREATE TABLE IF NOT EXISTS \"account_setting_options\" (\n\t\"account_id\" text,\n\t\"setting_option_id\" text,\n\t\"value\" text,\n\t\"updated_at\" integer,\n\tFOREIGN KEY (\"account_id\") REFERENCES \"accounts\"(\"id\") ON UPDATE no action ON DELETE cascade,\n\tFOREIGN KEY (\"setting_option_id\") REFERENCES \"setting_options\"(\"id\") ON UPDATE no action ON DELETE cascade\n);\nCREATE TABLE IF NOT EXISTS \"setting_options\" (\n\t\"id\" text PRIMARY KEY NOT NULL,\n\t\"name\" text,\n\t\"spec\" text\n);",
  },
} as const;

export type Dialect = keyof typeof createScripts;
