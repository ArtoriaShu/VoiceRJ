import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, extname, relative } from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db.js';
import { libraryRoots, scanJobs, subtitleTracks, tracks, works } from './schema.js';
import { resolveInRoot } from './path-safety.js';
import { parseSubtitles } from './subtitles.js';

const audioExtensions = new Set(['.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus']);
const subtitleExtensions = new Set(['.lrc', '.vtt', '.srt']);
const coverExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const sort = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

async function walk(root: string, directory = ''): Promise<string[]> {
  const entries = await readdir(resolveInRoot(root, directory), { withFileTypes: true }).catch(() => []);
  const children = await Promise.all(entries.map(async entry => {
    const item = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return walk(root, item);
    return (audioExtensions.has(extname(entry.name).toLowerCase()) || subtitleExtensions.has(extname(entry.name).toLowerCase()) || coverExtensions.has(extname(entry.name).toLowerCase())) ? [item] : [];
  }));
  return children.flat();
}

const rjFrom = (path: string) => path.match(/RJ\d+/i)?.[0]?.toUpperCase() ?? null;
const mediaStem = (file: string) => basename(file)
  .replace(/\.(?:lrc|vtt|srt)$/i, '')
  .replace(/\.(?:mp3|flac|wav|m4a|aac|ogg|opus)$/i, '')
  .toLocaleLowerCase();

/** Keep a release and all of its nested track folders together. */
function workFolderFor(file: string) {
  const parts = file.split('/');
  const folderParts = parts.slice(0, -1);
  const rjIndex = folderParts.findIndex(part => /^RJ\d+/i.test(part));
  if (rjIndex >= 0) return folderParts.slice(0, rjIndex + 1).join('/');
  return folderParts[0] ?? '';
}

function subtitleSource(file: string): 'official' | 'ai' | 'unknown' {
  const name = basename(file, extname(file)).toLowerCase();
  if (/(?:^|[ _.-])ai(?:[ _.-]|$)|人工|生成/.test(name)) return 'ai';
  if (/official|官方|字幕|lyrics?|歌詞/.test(name)) return 'official';
  return 'unknown';
}

export async function scanRoot(rootId: number) {
  const root = await db.select().from(libraryRoots).where(eq(libraryRoots.id, rootId)).get();
  if (!root) throw new Error('Library root not found.');
  const rootStat = await stat(root.path).catch(() => undefined);
  const now = Date.now();
  if (!rootStat?.isDirectory()) {
    // A folder can be removed in Finder or unplugged before a rescan. Keep its
    // metadata for a possible future reconnect, but never leave unusable works
    // visible in the active library.
    await db.update(tracks).set({ missing: true }).where(sql`${tracks.workId} in (select id from works where root_id = ${root.id})`);
    await db.update(works).set({ missing: true, updatedAt: now }).where(eq(works.rootId, root.id));
    await db.insert(scanJobs).values({ rootId, status: 'completed', summary: 'Configured media directory is unavailable; indexed works were hidden.', startedAt: now, finishedAt: now });
    return { files: 0, created: 0, updated: 0, unavailable: true };
  }
  const job = await db.insert(scanJobs).values({ rootId, status: 'running', startedAt: now }).returning({ id: scanJobs.id }).get();
  let created = 0, updated = 0;
  try {
    const existing = await db.select({ id: tracks.id }).from(tracks).innerJoin(works, eq(tracks.workId, works.id)).where(eq(works.rootId, root.id));
    await db.update(tracks).set({ missing: true }).where(eq(tracks.workId, -1));
    // Mark tracks present under this root missing; each discovered track is restored below.
    for (const row of existing) await db.update(tracks).set({ missing: true }).where(eq(tracks.id, row.id));
    const scanned = (await walk(root.path)).sort(sort.compare);
    const files = scanned.filter(file => audioExtensions.has(extname(file).toLowerCase()));
    const subtitleFiles = scanned.filter(file => subtitleExtensions.has(extname(file).toLowerCase()));
    const coverFiles = scanned.filter(file => coverExtensions.has(extname(file).toLowerCase()));
    for (const file of files) {
      const fileStat = await stat(resolveInRoot(root.path, file));
      const folderPath = workFolderFor(file);
      const folderName = basename(folderPath || root.path);
      let work = await db.select().from(works).where(and(eq(works.rootId, root.id), eq(works.folderPath, folderPath))).get();
      if (!work) {
        work = await db.insert(works).values({ rootId: root.id, folderPath, folderName, rjCode: rjFrom(folderName) ?? rjFrom(file), missing: false, updatedAt: now }).returning().get();
        created++;
      } else {
        await db.update(works).set({ missing: false, updatedAt: now }).where(eq(works.id, work.id));
      }
      const existingTrack = await db.select().from(tracks).where(and(eq(tracks.workId, work.id), eq(tracks.relativePath, file))).get();
      const values = { title: basename(file, extname(file)), size: fileStat.size, mtimeMs: Math.floor(fileStat.mtimeMs), missing: false, sortKey: file.toLocaleLowerCase() };
      if (!existingTrack) { await db.insert(tracks).values({ workId: work.id, relativePath: file, ...values }); created++; }
      else if (existingTrack.size !== values.size || existingTrack.mtimeMs !== values.mtimeMs || existingTrack.missing) { await db.update(tracks).set(values).where(eq(tracks.id, existingTrack.id)); updated++; }
    }
    for (const work of await db.select().from(works).where(eq(works.rootId, root.id))) {
      const cover = coverFiles.find(file => dirname(file) === work.folderPath && /^(cover|folder|jacket|image)/i.test(basename(file))) ?? coverFiles.find(file => dirname(file) === work.folderPath);
      await db.update(works).set({ coverPath: cover ?? null }).where(eq(works.id, work.id));
      const workTracks = await db.select().from(tracks).where(and(eq(tracks.workId, work.id), eq(tracks.missing, false)));
      await db.delete(subtitleTracks).where(sql`${subtitleTracks.trackId} in (select id from tracks where work_id = ${work.id})`);
      for (const subtitle of subtitleFiles.filter(file => workFolderFor(file) === work.folderPath)) {
        // Download tools commonly write subtitle sidecars as `track.mp3.vtt`.
        // Strip both suffixes so those files associate with `track.mp3`.
        const stem = mediaStem(subtitle);
        const matched = workTracks.find(track => dirname(track.relativePath) === dirname(subtitle) && mediaStem(track.relativePath) === stem)
          ?? workTracks.find(track => mediaStem(track.relativePath) === stem);
        if (!matched) continue;
        const cues = parseSubtitles(await readFile(resolveInRoot(root.path, subtitle), 'utf8').catch(() => ''), extname(subtitle).toLowerCase());
        if (cues.length) await db.insert(subtitleTracks).values({ trackId: matched.id, relativePath: subtitle, sourceType: subtitleSource(subtitle), encoding: 'utf-8', cuesJson: JSON.stringify(cues) });
      }
    }
    const indexedWorks = await db.select({ id: works.id }).from(works).where(eq(works.rootId, root.id));
    for (const work of indexedWorks) {
      const available = await db.select({ id: tracks.id }).from(tracks).where(and(eq(tracks.workId, work.id), eq(tracks.missing, false))).get();
      await db.update(works).set({ missing: !available, updatedAt: now }).where(eq(works.id, work.id));
    }
    const summary = `Indexed ${files.length} audio files and ${subtitleFiles.length} subtitle files (${created} created, ${updated} changed).`;
    await db.update(scanJobs).set({ status: 'completed', summary, finishedAt: Date.now() }).where(eq(scanJobs.id, job.id));
    return { files: files.length, created, updated };
  } catch (error) {
    await db.update(scanJobs).set({ status: 'failed', summary: error instanceof Error ? error.message : 'Unknown scan error', finishedAt: Date.now() }).where(eq(scanJobs.id, job.id));
    throw error;
  }
}
