import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { config } from './config.js';
import { db, sqlite } from './db.js';
import { libraryRoots, playbackProgress, subtitleTracks, tags, trackTags, tracks, wishlistWorks, workTags, works } from './schema.js';
import { cookieOptions, createSession, ensurePassword, getSession, removeSession, sessionCookie, verifyPassword } from './security.js';
import { resolveInRoot } from './path-safety.js';
import { scanRoot } from './scanner.js';
import { fetchAsmrOne, fetchDlsite } from './metadata.js';
import { discovery, scheduleDiscoveryRefresh } from './discovery.js';

declare module 'fastify' { interface FastifyRequest { session?: { id: string; csrfToken: string } } }

const app = Fastify({ logger: true, trustProxy: config.trustProxy });
const coverCache = new Map<string, { body: Buffer; type: string; expiresAt: number }>();
const isDlsiteAssetUrl = (url: URL) => url.protocol === 'https:' && /(^|\.)dlsite\.(?:com|jp)$/i.test(url.hostname);
// An RJ identifier contains enough information to derive DLsite's standard
// 4:3 cover URL. This keeps manually imported wishlist entries useful right
// away, without making a batch import wait for metadata requests.
const wishlistFallbackCoverUrl = (rjCode: string) => {
  const serial = Number(rjCode.slice(2));
  if (!Number.isSafeInteger(serial) || serial < 1) return null;
  const bucket = `RJ${String(Math.ceil(serial / 1000) * 1000).padStart(8, '0')}`;
  return `https://img.dlsite.jp/modpub/images2/ana/doujin/${bucket}/${rjCode}_ana_img_main.webp`;
};
const execFileAsync = promisify(execFile);
await app.register(cookie);
await app.register(rateLimit, { global: false });
const migrationFolder = new URL('../drizzle', import.meta.url).pathname;
migrate(db, { migrationsFolder: migrationFolder });

// SQLite databases created by older builds could contain works after their
// library root was deleted. Explicitly delete the complete index tree so a
// removed directory can never leave unplayable cards behind.
const purgeLibraryRoot = sqlite.transaction((rootId: number) => {
  const workIds = '(select id from works where root_id = ?)';
  const trackIds = `(select id from tracks where work_id in ${workIds})`;
  sqlite.prepare(`delete from subtitle_tracks where track_id in ${trackIds}`).run(rootId);
  sqlite.prepare(`delete from playback_progress where track_id in ${trackIds}`).run(rootId);
  sqlite.prepare(`delete from track_tags where track_id in ${trackIds}`).run(rootId);
  sqlite.prepare(`delete from tracks where work_id in ${workIds}`).run(rootId);
  sqlite.prepare(`delete from work_tags where work_id in ${workIds}`).run(rootId);
  sqlite.prepare('delete from works where root_id = ?').run(rootId);
  sqlite.prepare('delete from scan_jobs where root_id = ?').run(rootId);
  sqlite.prepare('delete from library_roots where id = ?').run(rootId);
});

const orphanRootIds = sqlite.prepare('select distinct root_id as id from works where root_id not in (select id from library_roots)').all() as Array<{ id: number }>;
for (const root of orphanRootIds) purgeLibraryRoot(root.id);
sqlite.prepare('delete from scan_jobs where root_id is not null and root_id not in (select id from library_roots)').run();
scheduleDiscoveryRefresh();
if (!config.disableAuth) await ensurePassword();

app.get('/health', async () => ({ ok: true }));
app.post('/api/auth/login', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
  if (config.disableAuth) return { csrfToken: 'testing-bypass', expiresAt: Number.MAX_SAFE_INTEGER };
  const parsed = z.object({ password: z.string().min(1).max(1024) }).safeParse(request.body);
  if (!parsed.success || !await verifyPassword(parsed.data.password)) return reply.code(401).send({ error: '密码不正确或登录已暂时冷却。' });
  const session = await createSession();
  reply.setCookie(sessionCookie, session.value, cookieOptions);
  return { csrfToken: session.csrfToken, expiresAt: session.expiresAt };
});
app.post('/api/auth/logout', async (request, reply) => { await removeSession(request.cookies[sessionCookie]); reply.clearCookie(sessionCookie, { path: '/' }); return { ok: true }; });

app.addHook('preHandler', async (request, reply) => {
  if (request.url === '/health' || !request.url.startsWith('/api/')) return;
  if (config.disableAuth) { request.session = { id: 'testing-bypass', csrfToken: 'testing-bypass' }; return; }
  if (request.url.startsWith('/api/auth/')) return;
  const session = await getSession(request.cookies[sessionCookie]);
  if (!session) return reply.code(401).send({ error: '需要登录。' });
  request.session = session;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers['x-csrf-token'] !== session.csrfToken) return reply.code(403).send({ error: 'CSRF 验证失败，请刷新页面。' });
});

app.get('/api/auth/me', async request => ({ csrfToken: request.session!.csrfToken }));
app.get('/api/discovery', async (request, reply) => { const { order, limit } = z.object({ order: z.enum(['trend', 'release_d', 'subtitle']), limit: z.coerce.number().int().min(1).max(100).default(20) }).parse(request.query); try { return await discovery(order, limit); } catch (error) { return reply.code(502).send({ error: error instanceof Error ? error.message : '发现源暂时不可用。' }); } });
app.get('/api/discovery/cover', async (request, reply) => { const { url } = z.object({ url: z.string().url().max(2048) }).parse(request.query); const parsed = new URL(url); if (!isDlsiteAssetUrl(parsed)) return reply.code(400).send({ error: '不允许的封面来源。' }); const cached = coverCache.get(url); if (cached && cached.expiresAt > Date.now()) return reply.header('Content-Type', cached.type).send(cached.body); const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); const length = Number(response.headers.get('content-length') ?? 0); if (!response.ok || length > 8_000_000) return reply.code(502).send({ error: '封面不可用或超过大小限制。' }); const body = Buffer.from(await response.arrayBuffer()); if (body.length > 8_000_000) return reply.code(502).send({ error: '封面超过大小限制。' }); const type = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'; if (!type.startsWith('image/')) return reply.code(502).send({ error: '来源不是图像。' }); coverCache.set(url, { body, type, expiresAt: Date.now() + 3600_000 }); return reply.header('Content-Type', type).header('Cache-Control', 'private, max-age=3600').send(body); });
app.get('/api/wishlist', async () => db.select().from(wishlistWorks).orderBy(desc(wishlistWorks.addedAt)));
app.post('/api/wishlist', async (request, reply) => {
  const body = z.object({ rjCode: z.string().trim().regex(/^RJ\d{8}$/i), title: z.string().trim().min(1).max(1000), voiceActors: z.string().trim().max(500).nullable().optional(), coverUrl: z.string().url().max(2048).nullable().optional() }).parse(request.body);
  const rjCode = body.rjCode.toUpperCase();
  const coverUrl = body.coverUrl ?? null;
  if (coverUrl && !isDlsiteAssetUrl(new URL(coverUrl))) return reply.code(400).send({ error: '不允许的封面来源。' });
  const item = { rjCode, title: body.title, voiceActors: body.voiceActors || null, coverUrl, sourceUrl: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`, addedAt: Date.now() };
  await db.insert(wishlistWorks).values(item).onConflictDoUpdate({ target: wishlistWorks.rjCode, set: { title: item.title, voiceActors: item.voiceActors, coverUrl: item.coverUrl, sourceUrl: item.sourceUrl } });
  return item;
});
app.post('/api/wishlist/import', async request => {
  const rjCodes = z.object({ rjCodes: z.array(z.string().trim().regex(/^RJ\d{8}$/i)).min(1).max(100) }).parse(request.body).rjCodes;
  const uniqueCodes = [...new Set(rjCodes.map(code => code.toUpperCase()))];
  const addedAt = Date.now();
  let added = 0;
  for (const rjCode of uniqueCodes) {
    const existing = await db.select({ rjCode: wishlistWorks.rjCode, coverUrl: wishlistWorks.coverUrl }).from(wishlistWorks).where(eq(wishlistWorks.rjCode, rjCode)).get();
    const coverUrl = wishlistFallbackCoverUrl(rjCode);
    if (!existing) {
      await db.insert(wishlistWorks).values({ rjCode, title: rjCode, voiceActors: null, coverUrl, sourceUrl: `https://www.dlsite.com/maniax/work/=/product_id/${rjCode}.html`, addedAt });
      added++;
    } else if (!existing.coverUrl && coverUrl) {
      // Re-importing an older manually entered RJ code upgrades its formerly
      // blank card without overwriting a title or cover obtained from DLsite.
      await db.update(wishlistWorks).set({ coverUrl }).where(eq(wishlistWorks.rjCode, rjCode));
    }
  }
  return { added, existing: uniqueCodes.length - added, total: uniqueCodes.length };
});
app.delete('/api/wishlist/:rjCode', async request => {
  const rjCode = z.string().regex(/^RJ\d{8}$/i).parse((request.params as { rjCode: string }).rjCode).toUpperCase();
  await db.delete(wishlistWorks).where(eq(wishlistWorks.rjCode, rjCode));
  return { ok: true };
});
app.get('/api/roots', async () => db.select({ id: libraryRoots.id, label: libraryRoots.label, enabled: libraryRoots.enabled }).from(libraryRoots).orderBy(asc(libraryRoots.label)));
app.post('/api/roots/pick', async (request, reply) => {
  if (process.platform !== 'darwin') return reply.code(501).send({ error: '当前系统不支持原生目录选择，请直接输入路径。' });
  try {
    const { stdout } = await execFileAsync('/usr/bin/osascript', ['-e', 'POSIX path of (choose folder with prompt "选择音声资料库目录")'], { timeout: 120_000, maxBuffer: 4096 });
    const path = stdout.trim();
    if (!path) return reply.code(400).send({ error: '没有选择目录。' });
    return { path, label: basename(path) };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/User canceled|取消/.test(message)) return reply.code(400).send({ error: '已取消目录选择。' });
    return reply.code(500).send({ error: '无法打开原生目录选择器。' });
  }
});
app.post('/api/roots', async (request, reply) => {
  const parsed = z.object({ path: z.string().trim().min(1).max(2048), label: z.string().trim().max(120).optional() }).safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: '请输入有效的目录路径和名称。' });
  const path = resolve(parsed.data.path);
  // A trailing slash makes `path.split('/').pop()` empty in older clients.
  // The server owns this fallback so a valid directory path is always enough.
  const label = parsed.data.label || basename(path) || path;
  try { await access(path, constants.R_OK); const info = await stat(path); if (!info.isDirectory()) throw new Error('not directory'); } catch { return reply.code(400).send({ error: '目录不存在、不可读取或不是目录。' }); }
  const now = Date.now();
  // Adding a path that was previously indexed should be safe. Re-enable and
  // refresh the existing record instead of leaking SQLite's unique-index
  // error as a generic 500 response.
  const existing = await db.select().from(libraryRoots).where(eq(libraryRoots.path, path)).get();
  if (existing) {
    const root = await db.update(libraryRoots).set({ label, enabled: true, updatedAt: now }).where(eq(libraryRoots.id, existing.id)).returning().get();
    return reply.send({ id: root!.id, label: root!.label, enabled: root!.enabled, existing: true });
  }
  const root = await db.insert(libraryRoots).values({ path, label, createdAt: now, updatedAt: now }).returning().get();
  return reply.code(201).send({ id: root.id, label: root.label, enabled: root.enabled });
});
app.patch('/api/roots/:id', async request => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const body = z.object({ label: z.string().trim().min(1).max(120).optional(), enabled: z.boolean().optional() }).parse(request.body);
  const root = await db.update(libraryRoots).set({ ...body, updatedAt: Date.now() }).where(eq(libraryRoots.id, id)).returning().get();
  return root ? { id: root.id, label: root.label, enabled: root.enabled } : undefined;
});
app.delete('/api/roots/:id', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const root = await db.select({ id: libraryRoots.id }).from(libraryRoots).where(eq(libraryRoots.id, id)).get();
  if (!root) return reply.code(404).send({ error: '目录不存在。' });
  purgeLibraryRoot(id);
  return { ok: true };
});
app.post('/api/roots/:id/scan', async request => { const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id); return scanRoot(id); });
app.get('/api/works', async request => {
  const query = z.object({ q: z.string().max(200).optional(), rootId: z.coerce.number().int().positive().optional(), tagId: z.coerce.number().int().positive().optional(), sort: z.enum(['updated', 'title']).default('updated') }).parse(request.query);
  const conditions = [eq(works.missing, false)];
  if (query.rootId) conditions.push(eq(works.rootId, query.rootId));
  if (query.tagId) conditions.push(sql`${works.id} in (select work_id from work_tags where tag_id = ${query.tagId})`);
  if (query.q) { const term = `%${query.q}%`; conditions.push(or(like(works.folderName, term), like(works.rjCode, term), like(works.manualTitle, term), like(works.asmrOneNormalizedTitle, term), like(works.dlsiteTitle, term), like(works.circle, term))!); }
  const title = sql<string>`coalesce(${works.manualTitle}, ${works.asmrOneNormalizedTitle}, ${works.dlsiteTitle}, ${works.folderName})`;
  const rows = await db.select({ id: works.id, rjCode: works.rjCode, title, folderName: works.folderName, circle: works.circle, voiceActors: works.voiceActors, coverPath: works.coverPath, remoteCoverUrl: works.remoteCoverUrl, rootId: works.rootId, trackCount: sql<number>`count(distinct ${tracks.id})`, subtitleSource: sql<string | null>`case when max(case when ${subtitleTracks.sourceType} = 'official' then 2 when ${subtitleTracks.sourceType} = 'ai' then 1 else 0 end) = 2 then 'official' when max(case when ${subtitleTracks.sourceType} = 'ai' then 1 else 0 end) = 1 then 'ai' else null end` }).from(works).innerJoin(libraryRoots, eq(libraryRoots.id, works.rootId)).leftJoin(tracks, and(eq(tracks.workId, works.id), eq(tracks.missing, false))).leftJoin(subtitleTracks, eq(subtitleTracks.trackId, tracks.id)).where(and(...conditions)).groupBy(works.id).orderBy(query.sort === 'title' ? asc(title) : desc(works.updatedAt));
  return rows;
});
app.get('/api/recent', async () => db.select({ trackId: tracks.id, trackTitle: tracks.title, workId: works.id, workTitle: sql<string>`coalesce(${works.manualTitle}, ${works.asmrOneNormalizedTitle}, ${works.dlsiteTitle}, ${works.folderName})`, positionMs: playbackProgress.positionMs, updatedAt: playbackProgress.updatedAt }).from(playbackProgress).innerJoin(tracks, eq(playbackProgress.trackId, tracks.id)).innerJoin(works, eq(tracks.workId, works.id)).orderBy(desc(playbackProgress.updatedAt)).limit(40));
app.get('/api/works/:id', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const work = await db.select().from(works).where(eq(works.id, id)).get();
  if (!work) return reply.code(404).send({ error: '作品不存在。' });
  const items = await db.select().from(tracks).where(and(eq(tracks.workId, id), eq(tracks.missing, false))).orderBy(asc(tracks.sortKey));
  const subtitles = await db.select().from(subtitleTracks).where(sql`${subtitleTracks.trackId} in (select id from tracks where work_id = ${id})`);
  const labels = await db.select({ id: tags.id, name: tags.name, source: tags.source }).from(workTags).innerJoin(tags, eq(workTags.tagId, tags.id)).where(eq(workTags.workId, id));
  const trackLabels = await db.select({ trackId: trackTags.trackId, id: tags.id, name: tags.name, source: tags.source }).from(trackTags).innerJoin(tags, eq(trackTags.tagId, tags.id)).where(sql`${trackTags.trackId} in (select id from tracks where work_id = ${id})`);
  return { ...work, displayTitle: work.manualTitle ?? work.asmrOneNormalizedTitle ?? work.dlsiteTitle ?? work.folderName, tracks: items, subtitles, tags: labels, trackTags: trackLabels };
});
app.patch('/api/works/:id', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const body = z.object({ rjCode: z.string().regex(/^RJ\d+$/i).optional().nullable(), manualTitle: z.string().trim().max(300).optional().nullable() }).parse(request.body);
  if (body.manualTitle !== undefined && body.manualTitle !== null && !body.manualTitle) return reply.code(400).send({ error: '标题不能为空。' });
  const work = await db.update(works).set({ ...body, rjCode: body.rjCode?.toUpperCase(), updatedAt: Date.now() }).where(eq(works.id, id)).returning().get();
  if (!work) return reply.code(404).send({ error: '作品不存在。' });
  return { ...work, displayTitle: work.manualTitle ?? work.asmrOneNormalizedTitle ?? work.dlsiteTitle ?? work.folderName };
});

async function replaceDlsiteTags(workId: number, names: string[]) {
  // ASMR.ONE is title-only. Replace its historic labels along with previously
  // synced official labels so a work only shows DLsite's canonical genres.
  await db.delete(workTags).where(sql`${workTags.workId} = ${workId} and ${workTags.tagId} in (select id from tags where source in ('dlsite', 'asmr-one'))`);
  for (const name of names) {
    const tag = await db.insert(tags).values({ name, source: 'dlsite' })
      .onConflictDoUpdate({ target: tags.name, set: { source: 'dlsite' } })
      .returning().get();
    if (tag) await db.insert(workTags).values({ workId, tagId: tag.id }).onConflictDoNothing();
  }
}

app.post('/api/works/:id/sync/asmr-one', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const work = await db.select().from(works).where(eq(works.id, id)).get();
  if (!work?.rjCode) return reply.code(400).send({ error: '请先填写有效的 RJ 编号。' });
  try {
    const result = await fetchAsmrOne(work.rjCode);
    const now = Date.now();
    const updated = await db.update(works).set({ asmrOneRawTitle: result.rawTitle, asmrOneNormalizedTitle: result.normalizedTitle, asmrOneSourceUrl: result.sourceUrl, asmrOneSyncedAt: now, updatedAt: now }).where(eq(works.id, id)).returning().get();
    await db.delete(workTags).where(sql`${workTags.workId} = ${id} and ${workTags.tagId} in (select id from tags where source = 'asmr-one')`);
    return { ...result, work: { ...updated, displayTitle: updated!.manualTitle ?? updated!.asmrOneNormalizedTitle ?? updated!.dlsiteTitle ?? updated!.folderName } };
  } catch (error) { return reply.code(502).send({ error: error instanceof Error ? error.message : '中文标题同步失败。' }); }
});
app.post('/api/works/:id/sync/dlsite', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const work = await db.select().from(works).where(eq(works.id, id)).get();
  if (!work?.rjCode) return reply.code(400).send({ error: '请先填写有效的 RJ 编号。' });
  try {
    const result = await fetchDlsite(work.rjCode);
    const now = Date.now();
    const updated = await db.update(works).set({ dlsiteTitle: result.title, circle: result.circle, voiceActors: result.voiceActors, remoteCoverUrl: result.coverUrl, dlsiteSourceUrl: result.sourceUrl, dlsiteSyncedAt: now, updatedAt: now }).where(eq(works.id, id)).returning().get();
    await replaceDlsiteTags(id, result.tags);
    return { ...result, work: { ...updated, displayTitle: updated!.manualTitle ?? updated!.asmrOneNormalizedTitle ?? updated!.dlsiteTitle ?? updated!.folderName } };
  } catch (error) { return reply.code(502).send({ error: error instanceof Error ? error.message : 'DLsite 同步失败。' }); }
});
app.post('/api/works/sync/dlsite', async (_request, reply) => {
  const candidates = await db.select({ id: works.id, rjCode: works.rjCode }).from(works).where(and(eq(works.missing, false), sql`${works.rjCode} is not null`));
  const result = { total: candidates.length, synced: 0, failed: 0, skipped: 0, failures: [] as Array<{ rjCode: string; error: string }> };
  for (const work of candidates) {
    if (!work.rjCode) { result.skipped++; continue; }
    try {
      const metadata = await fetchDlsite(work.rjCode);
      const now = Date.now();
      await db.update(works).set({ dlsiteTitle: metadata.title, circle: metadata.circle, voiceActors: metadata.voiceActors, remoteCoverUrl: metadata.coverUrl, dlsiteSourceUrl: metadata.sourceUrl, dlsiteSyncedAt: now, updatedAt: now }).where(eq(works.id, work.id));
      await replaceDlsiteTags(work.id, metadata.tags);
      result.synced++;
    } catch (error) {
      result.failed++;
      result.failures.push({ rjCode: work.rjCode, error: error instanceof Error ? error.message : '同步失败' });
    }
  }
  return result;
});
app.get('/api/works/:id/cover', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const item = await db.select({ coverPath: works.coverPath, remoteCoverUrl: works.remoteCoverUrl, rootPath: libraryRoots.path }).from(works).innerJoin(libraryRoots, eq(works.rootId, libraryRoots.id)).where(eq(works.id, id)).get();
  if (!item) return reply.code(404).send({ error: '封面不存在。' });
  if (!item.coverPath && item.remoteCoverUrl) { const url = new URL(item.remoteCoverUrl); if (!isDlsiteAssetUrl(url)) return reply.code(400).send({ error: '不允许的封面来源。' }); const response = await fetch(item.remoteCoverUrl, { signal: AbortSignal.timeout(10000) }); if (!response.ok) return reply.code(502).send({ error: '远程封面不可用。' }); const type = response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'; if (!type.startsWith('image/')) return reply.code(502).send({ error: '远程资源不是图像。' }); return reply.header('Content-Type', type).header('Cache-Control', 'private, max-age=3600').send(Buffer.from(await response.arrayBuffer())); }
  if (!item.coverPath) return reply.code(404).send({ error: '封面不存在。' });
  const path = resolveInRoot(item.rootPath, item.coverPath); const info = await stat(path).catch(() => undefined);
  if (!info?.isFile()) return reply.code(404).send({ error: '封面当前不可用。' });
  const type = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
  reply.header('Content-Type', type).header('Content-Length', info.size).header('Cache-Control', 'private, max-age=3600'); return reply.send(createReadStream(path));
});
app.get('/api/tracks/:id/subtitles', async request => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  return db.select().from(subtitleTracks).where(eq(subtitleTracks.trackId, id));
});
app.get('/api/tags', async () => db.select().from(tags).orderBy(asc(tags.name)));
app.post('/api/works/:id/tags', async (request, reply) => {
  const workId = z.coerce.number().int().positive().parse((request.params as { id: string }).id); const name = z.object({ name: z.string().trim().min(1).max(40) }).parse(request.body).name;
  const tag = await db.insert(tags).values({ name, source: 'user' }).onConflictDoNothing().returning().get() ?? await db.select().from(tags).where(eq(tags.name, name)).get();
  if (!tag) return reply.code(500).send({ error: '标签保存失败。' }); await db.insert(workTags).values({ workId, tagId: tag.id }).onConflictDoNothing(); return tag;
});
app.delete('/api/works/:id/tags/:tagId', async request => { const { id, tagId } = request.params as { id: string; tagId: string }; await db.delete(workTags).where(and(eq(workTags.workId, z.coerce.number().parse(id)), eq(workTags.tagId, z.coerce.number().parse(tagId)))); return { ok: true }; });
app.post('/api/tracks/:id/tags', async (request, reply) => { const trackId = z.coerce.number().int().positive().parse((request.params as { id: string }).id); const name = z.object({ name: z.string().trim().min(1).max(40) }).parse(request.body).name; const tag = await db.insert(tags).values({ name, source: 'user' }).onConflictDoNothing().returning().get() ?? await db.select().from(tags).where(eq(tags.name, name)).get(); if (!tag) return reply.code(500).send({ error: '标签保存失败。' }); await db.insert(trackTags).values({ trackId, tagId: tag.id }).onConflictDoNothing(); return tag; });
app.delete('/api/tracks/:id/tags/:tagId', async request => { const { id, tagId } = request.params as { id: string; tagId: string }; await db.delete(trackTags).where(and(eq(trackTags.trackId, z.coerce.number().parse(id)), eq(trackTags.tagId, z.coerce.number().parse(tagId)))); return { ok: true }; });
app.patch('/api/subtitles/:id', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const body = z.object({ sourceType: z.enum(['official', 'ai', 'unknown']).optional(), language: z.string().trim().max(32).optional().nullable(), trackId: z.number().int().positive().optional() }).parse(request.body);
  if (body.trackId) {
    const current = await db.select({ workId: tracks.workId }).from(subtitleTracks).innerJoin(tracks, eq(subtitleTracks.trackId, tracks.id)).where(eq(subtitleTracks.id, id)).get();
    const destination = await db.select({ workId: tracks.workId }).from(tracks).where(eq(tracks.id, body.trackId)).get();
    if (!current || !destination || current.workId !== destination.workId) return reply.code(400).send({ error: '字幕只能关联到同一作品的音轨。' });
  }
  const item = await db.update(subtitleTracks).set(body).where(eq(subtitleTracks.id, id)).returning().get();
  if (!item) return reply.code(404).send({ error: '字幕不存在。' }); return item;
});
app.put('/api/tracks/:id/progress', async request => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const body = z.object({ positionMs: z.number().int().min(0), completed: z.boolean().optional() }).parse(request.body);
  await db.insert(playbackProgress).values({ trackId: id, positionMs: body.positionMs, completed: body.completed ?? false, updatedAt: Date.now() }).onConflictDoUpdate({ target: playbackProgress.trackId, set: { ...body, updatedAt: Date.now() } });
  return { ok: true };
});
app.get('/api/tracks/:id/audio', async (request, reply) => {
  const id = z.coerce.number().int().positive().parse((request.params as { id: string }).id);
  const item = await db.select({ relativePath: tracks.relativePath, rootPath: libraryRoots.path }).from(tracks).innerJoin(works, eq(tracks.workId, works.id)).innerJoin(libraryRoots, eq(works.rootId, libraryRoots.id)).where(and(eq(tracks.id, id), eq(tracks.missing, false))).get();
  if (!item) return reply.code(404).send({ error: '音频文件不存在。' });
  const path = resolveInRoot(item.rootPath, item.relativePath);
  const info = await stat(path).catch(() => undefined);
  if (!info?.isFile()) return reply.code(404).send({ error: '音频文件当前不可用。' });
  const range = request.headers.range;
  const type = { '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.aac': 'audio/aac' }[path.slice(path.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream';
  // HTTP header values are ASCII-only; raw CJK filenames otherwise make Node reject the audio response.
  reply.header('Accept-Ranges', 'bytes').header('Content-Type', type).header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(basename(path))}`);
  if (!range) { reply.header('Content-Length', info.size); return reply.send(createReadStream(path)); }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return reply.code(416).header('Content-Range', `bytes */${info.size}`).send();
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Number(match[2]) : info.size - 1;
  if (start > end || end >= info.size) return reply.code(416).header('Content-Range', `bytes */${info.size}`).send();
  reply.code(206).header('Content-Range', `bytes ${start}-${end}/${info.size}`).header('Content-Length', end - start + 1);
  return reply.send(createReadStream(path, { start, end }));
});

const webRoot = resolve(fileURLToPath(new URL('../../web/dist', import.meta.url)));
if (process.env.NODE_ENV === 'production' && existsSync(webRoot)) {
  await app.register(fastifyStatic, { root: webRoot });
  app.setNotFoundHandler((request, reply) => request.url.startsWith('/api/') ? reply.code(404).send({ error: '接口不存在。' }) : reply.sendFile('index.html'));
}

app.listen({ port: config.port, host: '0.0.0.0' });
