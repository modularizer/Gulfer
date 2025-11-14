CREATE TABLE IF NOT EXISTS "event_format_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"event_format_id" text NOT NULL,
	"event_format_stage_id" text,
	"number" integer DEFAULT 0 NOT NULL,
	"score_format_id" text NOT NULL,
	FOREIGN KEY ("event_format_id") REFERENCES "event_formats"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("score_format_id") REFERENCES "score_formats"("id") ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "event_format_stages" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "event_format_stages" ("lat","lng");CREATE UNIQUE INDEX IF NOT EXISTS "event_format_stage_child" ON "event_format_stages" ("event_format_id","event_format_stage_id","number");CREATE TABLE IF NOT EXISTS "event_formats" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"sport_id" text NOT NULL,
	"score_format_id" text NOT NULL,
	"min_team_size" integer,
	"max_team_size" integer,
	"min_teams" integer,
	"max_teams" integer,
	"expected_min_duration" integer,
	"expected_duration" integer,
	"expected_max_duration" integer,
	FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("score_format_id") REFERENCES "score_formats"("id") ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "event_formats" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "event_formats" ("lat","lng");CREATE TABLE IF NOT EXISTS "score_formats" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"sport_id" text,
	"scoring_method_name" text NOT NULL,
	FOREIGN KEY ("sport_id") REFERENCES "sports"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "score_formats" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "score_formats" ("lat","lng");CREATE TABLE IF NOT EXISTS "named_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"score_format_id" text NOT NULL,
	"value" text,
	"points" real,
	"won" integer,
	"lost" integer,
	"tied" integer,
	"win_margin" real,
	"loss_margin" real,
	"points_behind_previous" real,
	"points_ahead_of_next" real,
	FOREIGN KEY ("score_format_id") REFERENCES "score_formats"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "named_scores" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "named_scores" ("lat","lng");CREATE TABLE IF NOT EXISTS "sports" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "sports" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "sports" ("lat","lng");CREATE TABLE IF NOT EXISTS "venue_event_format_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"venue_event_format_id" text NOT NULL,
	"event_format_stage_id" text NOT NULL,
	"venue_event_format_stage_id" text,
	"number" integer DEFAULT 0 NOT NULL,
	FOREIGN KEY ("venue_event_format_id") REFERENCES "venue_event_formats"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("event_format_stage_id") REFERENCES "event_format_stages"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "venue_event_format_stages" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "venue_event_format_stages" ("lat","lng");CREATE UNIQUE INDEX IF NOT EXISTS "event_format_stage_child" ON "venue_event_format_stages" ("venue_event_format_id","venue_event_format_stage_id","number");CREATE TABLE IF NOT EXISTS "venue_event_formats" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"venue_id" text NOT NULL,
	"event_format_id" text NOT NULL,
	"min_team_size" integer,
	"max_team_size" integer,
	"min_teams" integer,
	"max_teams" integer,
	"expected_min_duration" integer,
	"expected_duration" integer,
	"expected_max_duration" integer,
	FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("event_format_id") REFERENCES "event_formats"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "venue_event_formats" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "venue_event_formats" ("lat","lng");CREATE TABLE IF NOT EXISTS "venues" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "venues" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "venues" ("lat","lng");CREATE TABLE IF NOT EXISTS "participants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"sex" text DEFAULT 'UNKNOWN' NOT NULL,
	"birthday" integer,
	"is_team" integer DEFAULT false,
	"createdAt" integer,
	"deletedAt" integer
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "participants" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "participants" ("lat","lng");CREATE TABLE IF NOT EXISTS "team_members" (
	"id" text PRIMARY KEY NOT NULL,
	"team_id" text NOT NULL,
	"participant_id" text NOT NULL,
	FOREIGN KEY ("team_id") REFERENCES "participants"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "team_members_team_id_participant_id_unique" ON "team_members" ("team_id","participant_id");CREATE TABLE IF NOT EXISTS "event_participants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"event_id" text NOT NULL,
	"participant_id" text NOT NULL,
	FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "event_participants" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "event_participants" ("lat","lng");CREATE TABLE IF NOT EXISTS "event_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"event_id" text NOT NULL,
	"venue_event_format_stage_id" text NOT NULL,
	"start_time" integer,
	"end_time" integer,
	"active" integer,
	FOREIGN KEY ("event_id") REFERENCES "events"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("venue_event_format_stage_id") REFERENCES "venue_event_format_stages"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "event_stages" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "event_stages" ("lat","lng");CREATE TABLE IF NOT EXISTS "events" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"venue_event_format_id" text NOT NULL,
	"start_time" integer,
	"end_time" integer,
	"active" integer,
	FOREIGN KEY ("venue_event_format_id") REFERENCES "venue_event_formats"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "events" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "events" ("lat","lng");CREATE TABLE IF NOT EXISTS "participant_event_stage_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"notes" text(200),
	"lat" real,
	"lng" real,
	"metadata" text,
	"event_stage_id" text,
	"participant_id" text NOT NULL,
	"score_format_id" text NOT NULL,
	"value" text,
	"points" real,
	"won" integer,
	"lost" integer,
	"tied" integer,
	"win_margin" real,
	"loss_margin" real,
	"points_behind_previous" real,
	"points_ahead_of_next" real,
	"completed_at" integer,
	"complete" integer DEFAULT false NOT NULL,
	FOREIGN KEY ("event_stage_id") REFERENCES "event_stages"("id") ON UPDATE no action ON DELETE set null,
	FOREIGN KEY ("participant_id") REFERENCES "participants"("id") ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY ("score_format_id") REFERENCES "score_formats"("id") ON UPDATE no action ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "sports_name_unique" ON "participant_event_stage_scores" ("name");CREATE INDEX IF NOT EXISTS "undefined_lat_lng_idx" ON "participant_event_stage_scores" ("lat","lng");CREATE TABLE IF NOT EXISTS "photos" (
	"id" text PRIMARY KEY NOT NULL,
	"ref_id" text,
	"ref_table" text,
	"hash" text NOT NULL,
	"data" text,
	"created_at" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "photos_hash_unique" ON "photos" ("hash");CREATE TABLE IF NOT EXISTS "merge_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"foreign_storage_id" text NOT NULL,
	"foreign_id" text NOT NULL,
	"ref_table" text NOT NULL,
	"local_id" text NOT NULL,
	"merged_at" integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "merge_entries_foreign_storage_id_foreign_id_unique" ON "merge_entries" ("foreign_storage_id","foreign_id");