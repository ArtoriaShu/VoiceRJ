CREATE TABLE `wishlist_works` (
  `rj_code` text PRIMARY KEY NOT NULL,
  `title` text NOT NULL,
  `voice_actors` text,
  `cover_url` text,
  `source_url` text NOT NULL,
  `added_at` integer NOT NULL
);
