CREATE TABLE `tags` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL, `name` text NOT NULL, `source` text DEFAULT 'user' NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);
--> statement-breakpoint
CREATE TABLE `work_tags` (`work_id` integer NOT NULL, `tag_id` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_tags_unique` ON `work_tags` (`work_id`,`tag_id`);
--> statement-breakpoint
CREATE TABLE `track_tags` (`track_id` integer NOT NULL, `tag_id` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_tags_unique` ON `track_tags` (`track_id`,`tag_id`);
