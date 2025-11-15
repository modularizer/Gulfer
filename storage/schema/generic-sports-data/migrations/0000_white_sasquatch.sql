CREATE TABLE `event_format_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`event_format_id` text NOT NULL,
	`event_format_stage_id` text,
	`number` integer DEFAULT 0 NOT NULL,
	`score_format_id` text NOT NULL,
	FOREIGN KEY (`event_format_id`) REFERENCES `event_formats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`score_format_id`) REFERENCES `score_formats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `event_format_stages` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `event_format_stages` (`lat`,`lng`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_format_stage_child` ON `event_format_stages` (`event_format_id`,`event_format_stage_id`,`number`);--> statement-breakpoint
CREATE TABLE `event_formats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`sport_id` text NOT NULL,
	`score_format_id` text NOT NULL,
	`min_team_size` integer,
	`max_team_size` integer,
	`min_teams` integer,
	`max_teams` integer,
	`expected_min_duration` integer,
	`expected_duration` integer,
	`expected_max_duration` integer,
	FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`score_format_id`) REFERENCES `score_formats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `event_formats` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `event_formats` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `score_formats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`sport_id` text,
	`scoring_method_name` text NOT NULL,
	FOREIGN KEY (`sport_id`) REFERENCES `sports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `score_formats` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `score_formats` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `named_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`score_format_id` text NOT NULL,
	`value` text,
	`points` real,
	`won` integer,
	`lost` integer,
	`tied` integer,
	`win_margin` real,
	`loss_margin` real,
	`points_behind_previous` real,
	`points_ahead_of_next` real,
	FOREIGN KEY (`score_format_id`) REFERENCES `score_formats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `named_scores` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `named_scores` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `sports` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `sports` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `sports` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `venue_event_format_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`venue_event_format_id` text NOT NULL,
	`event_format_stage_id` text NOT NULL,
	`venue_event_format_stage_id` text,
	`number` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`venue_event_format_id`) REFERENCES `venue_event_formats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_format_stage_id`) REFERENCES `event_format_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `venue_event_format_stages` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `venue_event_format_stages` (`lat`,`lng`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_format_stage_child` ON `venue_event_format_stages` (`venue_event_format_id`,`venue_event_format_stage_id`,`number`);--> statement-breakpoint
CREATE TABLE `venue_event_formats` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`venue_id` text NOT NULL,
	`event_format_id` text NOT NULL,
	`min_team_size` integer,
	`max_team_size` integer,
	`min_teams` integer,
	`max_teams` integer,
	`expected_min_duration` integer,
	`expected_duration` integer,
	`expected_max_duration` integer,
	FOREIGN KEY (`venue_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_format_id`) REFERENCES `event_formats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `venue_event_formats` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `venue_event_formats` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `venues` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `venues` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`sex` text DEFAULT 'UNKNOWN' NOT NULL,
	`birthday` integer,
	`is_team` integer DEFAULT 0,
	`createdAt` integer,
	`deletedAt` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `participants` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `participants` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`participant_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_id_participant_id_unique` ON `team_members` (`team_id`,`participant_id`);--> statement-breakpoint
CREATE TABLE `event_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`event_id` text NOT NULL,
	`participant_id` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `event_participants` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `event_participants` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `event_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`event_id` text NOT NULL,
	`venue_event_format_stage_id` text NOT NULL,
	`start_time` integer,
	`end_time` integer,
	`active` integer,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`venue_event_format_stage_id`) REFERENCES `venue_event_format_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `event_stages` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `event_stages` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`venue_event_format_id` text NOT NULL,
	`start_time` integer,
	`end_time` integer,
	`active` integer,
	FOREIGN KEY (`venue_event_format_id`) REFERENCES `venue_event_formats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `events` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `events` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `participant_event_stage_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`notes` text(200),
	`lat` real,
	`lng` real,
	`metadata` text,
	`event_stage_id` text,
	`participant_id` text NOT NULL,
	`score_format_id` text NOT NULL,
	`value` text,
	`points` real,
	`won` integer,
	`lost` integer,
	`tied` integer,
	`win_margin` real,
	`loss_margin` real,
	`points_behind_previous` real,
	`points_ahead_of_next` real,
	`completed_at` integer,
	`complete` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_stage_id`) REFERENCES `event_stages`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`score_format_id`) REFERENCES `score_formats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sports_name_unique` ON `participant_event_stage_scores` (`name`);--> statement-breakpoint
CREATE INDEX `undefined_lat_lng_idx` ON `participant_event_stage_scores` (`lat`,`lng`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`ref_id` text,
	`ref_table` text,
	`hash` text NOT NULL,
	`data` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_hash_unique` ON `photos` (`hash`);--> statement-breakpoint
CREATE TABLE `merge_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`foreign_storage_id` text NOT NULL,
	`foreign_id` text NOT NULL,
	`ref_table` text NOT NULL,
	`local_id` text NOT NULL,
	`merged_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `merge_entries_foreign_storage_id_foreign_id_unique` ON `merge_entries` (`foreign_storage_id`,`foreign_id`);