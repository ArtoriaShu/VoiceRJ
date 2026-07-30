CREATE TABLE `settings` (`key` text PRIMARY KEY NOT NULL, `value` text NOT NULL);
--> statement-breakpoint
CREATE TABLE `library_roots` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `path` text NOT NULL, `label` text NOT NULL, `enabled` integer DEFAULT true NOT NULL, `created_at` integer NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_roots_path_unique` ON `library_roots` (`path`);
--> statement-breakpoint
CREATE TABLE `scan_jobs` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `root_id` integer, `status` text NOT NULL, `summary` text, `started_at` integer NOT NULL, `finished_at` integer);
--> statement-breakpoint
CREATE TABLE `works` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `root_id` integer NOT NULL, `folder_path` text NOT NULL, `folder_name` text NOT NULL, `rj_code` text, `dlsite_title` text, `asmr_one_raw_title` text, `asmr_one_normalized_title` text, `manual_title` text, `circle` text, `cover_path` text, `missing` integer DEFAULT false NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `works_root_folder_unique` ON `works` (`root_id`,`folder_path`);
--> statement-breakpoint
CREATE INDEX `works_rj_idx` ON `works` (`rj_code`);
--> statement-breakpoint
CREATE TABLE `tracks` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `work_id` integer NOT NULL, `relative_path` text NOT NULL, `title` text NOT NULL, `size` integer NOT NULL, `mtime_ms` integer NOT NULL, `duration_ms` integer, `codec` text, `channels` integer, `missing` integer DEFAULT false NOT NULL, `sort_key` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `tracks_work_path_unique` ON `tracks` (`work_id`,`relative_path`);
--> statement-breakpoint
CREATE TABLE `subtitle_tracks` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `track_id` integer NOT NULL, `relative_path` text NOT NULL, `language` text, `source_type` text DEFAULT 'unknown' NOT NULL, `encoding` text, `cues_json` text DEFAULT '[]' NOT NULL);
--> statement-breakpoint
CREATE TABLE `playback_progress` (`track_id` integer PRIMARY KEY NOT NULL, `position_ms` integer DEFAULT 0 NOT NULL, `completed` integer DEFAULT false NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE TABLE `sessions` (`id` text PRIMARY KEY NOT NULL, `token_hash` text NOT NULL, `csrf_token` text NOT NULL, `expires_at` integer NOT NULL, `created_at` integer NOT NULL);
