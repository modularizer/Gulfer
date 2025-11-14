CREATE TABLE IF NOT EXISTS "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"participant_id" text,
	"deleted_at" integer,
	FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS "account_setting_options" (
	"account_id" text,
	"setting_option_id" text,
	"value" text,
	"updated_at" integer,
	FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("setting_option_id") REFERENCES "setting_options"("id") ON UPDATE no action ON DELETE cascade
);
CREATE TABLE IF NOT EXISTS "setting_options" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"spec" text
);