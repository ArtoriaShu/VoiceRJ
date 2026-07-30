import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const libraryRoots = sqliteTable('library_roots', {
  id: integer('id').primaryKey({ autoIncrement: true }), path: text('path').notNull().unique(), label: text('label').notNull(), enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull()
});
export const scanJobs = sqliteTable('scan_jobs', { id: integer('id').primaryKey({ autoIncrement: true }), rootId: integer('root_id').references(() => libraryRoots.id), status: text('status').notNull(), summary: text('summary'), startedAt: integer('started_at').notNull(), finishedAt: integer('finished_at') });
export const works = sqliteTable('works', {
  id: integer('id').primaryKey({ autoIncrement: true }), rootId: integer('root_id').notNull().references(() => libraryRoots.id), folderPath: text('folder_path').notNull(), folderName: text('folder_name').notNull(), rjCode: text('rj_code'), dlsiteTitle: text('dlsite_title'), dlsiteSourceUrl: text('dlsite_source_url'), dlsiteSyncedAt: integer('dlsite_synced_at'), asmrOneRawTitle: text('asmr_one_raw_title'), asmrOneNormalizedTitle: text('asmr_one_normalized_title'), asmrOneSourceUrl: text('asmr_one_source_url'), asmrOneSyncedAt: integer('asmr_one_synced_at'), manualTitle: text('manual_title'), circle: text('circle'), voiceActors: text('voice_actors'), coverPath: text('cover_path'), remoteCoverUrl: text('remote_cover_url'), missing: integer('missing', { mode: 'boolean' }).notNull().default(false), updatedAt: integer('updated_at').notNull()
}, (t) => [uniqueIndex('works_root_folder_unique').on(t.rootId, t.folderPath), uniqueIndex('works_rj_idx').on(t.rjCode)]);
export const tracks = sqliteTable('tracks', {
  id: integer('id').primaryKey({ autoIncrement: true }), workId: integer('work_id').notNull().references(() => works.id), relativePath: text('relative_path').notNull(), title: text('title').notNull(), size: integer('size').notNull(), mtimeMs: integer('mtime_ms').notNull(), durationMs: integer('duration_ms'), codec: text('codec'), channels: integer('channels'), missing: integer('missing', { mode: 'boolean' }).notNull().default(false), sortKey: text('sort_key').notNull()
}, (t) => [uniqueIndex('tracks_work_path_unique').on(t.workId, t.relativePath)]);
export const subtitleTracks = sqliteTable('subtitle_tracks', { id: integer('id').primaryKey({ autoIncrement: true }), trackId: integer('track_id').notNull().references(() => tracks.id), relativePath: text('relative_path').notNull(), language: text('language'), sourceType: text('source_type').notNull().default('unknown'), encoding: text('encoding'), cuesJson: text('cues_json').notNull().default('[]') });
export const tags = sqliteTable('tags', { id: integer('id').primaryKey({ autoIncrement: true }), name: text('name').notNull().unique(), source: text('source').notNull().default('user') });
export const workTags = sqliteTable('work_tags', { workId: integer('work_id').notNull().references(() => works.id), tagId: integer('tag_id').notNull().references(() => tags.id) }, (t) => [uniqueIndex('work_tags_unique').on(t.workId, t.tagId)]);
export const trackTags = sqliteTable('track_tags', { trackId: integer('track_id').notNull().references(() => tracks.id), tagId: integer('tag_id').notNull().references(() => tags.id) }, (t) => [uniqueIndex('track_tags_unique').on(t.trackId, t.tagId)]);
export const playbackProgress = sqliteTable('playback_progress', { trackId: integer('track_id').primaryKey().references(() => tracks.id), positionMs: integer('position_ms').notNull().default(0), completed: integer('completed', { mode: 'boolean' }).notNull().default(false), updatedAt: integer('updated_at').notNull() });
export const wishlistWorks = sqliteTable('wishlist_works', {
  rjCode: text('rj_code').primaryKey(),
  title: text('title').notNull(),
  voiceActors: text('voice_actors'),
  coverUrl: text('cover_url'),
  sourceUrl: text('source_url').notNull(),
  addedAt: integer('added_at').notNull(),
});
export const sessions = sqliteTable('sessions', { id: text('id').primaryKey(), tokenHash: text('token_hash').notNull(), csrfToken: text('csrf_token').notNull(), expiresAt: integer('expires_at').notNull(), createdAt: integer('created_at').notNull() });
