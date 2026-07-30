import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fetchDlsiteVoiceActors } from './metadata.js';

type Discovery = { sourceId: string; title: string; voiceActors: string | null; voiceActorsFetchedAt: number | null; voiceActorsRetryAt: number | null; voiceActorsLookupVersion: number; sourceUrl: string; coverUrl: string | null; preorder: boolean };
type DiscoveryOrder = 'trend' | 'release_d' | 'subtitle';
const cache = new Map<string, { updatedAt: number; items: Discovery[] }>();
const refreshes = new Map<DiscoveryOrder, Promise<{ updatedAt: number; items: Discovery[] }>>();
const voiceEnrichments = new Map<DiscoveryOrder, Promise<boolean>>();
const dayMs = 24 * 60 * 60_000;
const persistentCache = process.env.NODE_ENV === 'production';
const cacheFile = resolve(process.env.DATA_DIR ?? './data', 'discovery-cache-v3.json');
// Keep the last good snapshot usable when a deployment upgrades the cache
// schema while DLsite is temporarily slow or unavailable.
const legacyCacheFiles = [
  resolve(process.env.DATA_DIR ?? './data', 'discovery-cache-v2.json'),
  resolve(process.env.DATA_DIR ?? './data', 'discovery-cache.json'),
];
let cacheLoaded = !persistentCache;
let refreshSchedulerStarted = false;
let cacheSave = Promise.resolve();
// Ranking sources chosen for the library: male audio / genre 048, with the
// third source limited to works that list a script/subtitle keyword.
const sourceUrls = {
  trend: 'https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category[0]/male/ana_flg/all/order/trend/work_type_category[0]/audio/genre[0]/048/options_and_or/and/options[0]/JPN/options[1]/NM/lang_options[0]/%E6%97%A5%E6%9C%AC%E8%AA%9E/lang_options[1]/%E8%A8%80%E8%AA%9E%E4%B8%8D%E8%A6%81',
  release_d: 'https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category[0]/male/ana_flg/all/order/release_d/work_type_category[0]/audio/genre[0]/048/options_and_or/and/options[0]/JPN/options[1]/NM/lang_options[0]/%E6%97%A5%E6%9C%AC%E8%AA%9E/lang_options[1]/%E8%A8%80%E8%AA%9E%E4%B8%8D%E8%A6%81',
  subtitle: 'https://www.dlsite.com/maniax/fsr/=/language/jp/sex_category%5B0%5D/male/keyword/%E5%8F%B0%E6%9C%AC/ana_flg/all/work_category%5B0%5D/doujin/work_category%5B1%5D/books/work_category%5B2%5D/pc/work_category%5B3%5D/app/order%5B0%5D/release_d/work_type_category%5B0%5D/audio/work_type_category_name%5B0%5D/%E9%9F%B3%E5%A3%B0%E3%83%BBASMR/genre%5B0%5D/048/genre_name%5B0%5D/%E5%AF%9D%E5%8F%96%E3%82%89%E3%82%8C/options_and_or/and/options%5B0%5D/JPN/options%5B1%5D/CHI/options%5B2%5D/CHI_HANS/options%5B3%5D/CHI_HANT/options%5B4%5D/NM/options_name%5B0%5D/%E6%97%A5%E8%AF%AD%E4%BD%9C%E5%93%81/options_name%5B1%5D/%E4%B8%AD%E6%96%87%E4%BD%9C%E5%93%81/options_name%5B2%5D/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87%E4%BD%9C%E5%93%81/options_name%5B3%5D/%E7%B9%81%E4%BD%93%E4%B8%AD%E6%96%87%E4%BD%9C%E5%93%81/options_name%5B4%5D/%E6%97%A0%E8%AF%AD%E8%A8%80%E9%99%90%E5%88%B6%E4%BD%9C%E5%93%81',
} as const;
const productUrl = (sourceId: string, order: DiscoveryOrder) => `https://www.dlsite.com/maniax/${order === 'release_d' ? 'announce' : 'work'}/=/product_id/${sourceId}.html`;
const clean = (value: string) => value.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const voiceActorsFromTitle = (title: string) => clean(/(?:[【\[]\s*CV\s*[:：\s]*|\bCV\s*[:：\s]+)([^】\]\n]+)/i.exec(title)?.[1] ?? '') || null;
function fallbackCoverUrl(sourceId: string) {
  const serial = Number(sourceId.slice(2));
  if (!Number.isSafeInteger(serial) || serial < 1) return null;
  const bucket = `RJ${String(Math.ceil(serial / 1000) * 1000).padStart(8, '0')}`;
  // DLsite's newer/pre-release works live under images2/ana. This is also a
  // valid high-resolution fallback for older cached cards whose old parser did
  // not recognise that path.
  return `https://img.dlsite.jp/modpub/images2/ana/doujin/${bucket}/${sourceId}_ana_img_main.webp`;
}
type CachedEntry = { updatedAt?: unknown; items?: unknown };
function restoreCache(snapshot: Record<string, CachedEntry>, preserveCurrent = false) {
  for (const order of ['trend', 'release_d', 'subtitle'] as const) {
    if (preserveCurrent && cache.has(order)) continue;
    const entry = snapshot[order];
    if (typeof entry?.updatedAt !== 'number' || !Array.isArray(entry.items)) continue;
    const items = entry.items.flatMap((item) => {
      const value = item as Partial<Discovery>;
      if (typeof value.sourceId !== 'string' || typeof value.title !== 'string' || typeof value.sourceUrl !== 'string') return [];
      return [{
        sourceId: value.sourceId,
        title: value.title,
        voiceActors: typeof value.voiceActors === 'string' ? value.voiceActors : voiceActorsFromTitle(value.title),
        voiceActorsFetchedAt: typeof value.voiceActorsFetchedAt === 'number' ? value.voiceActorsFetchedAt : null,
        voiceActorsLookupVersion: value.voiceActorsLookupVersion === 3 ? 3 : 0,
        // Caches created before retry metadata should get one fresh attempt,
        // rather than preserving a transient connection failure forever.
        voiceActorsRetryAt: value.voiceActorsLookupVersion === 3 && typeof value.voiceActorsRetryAt === 'number' ? value.voiceActorsRetryAt : typeof value.voiceActors === 'string' ? null : 0,
        // Old cache files used the regular work route for every entry. The
        // release feed consists of announcement pages, which use /announce/.
        sourceUrl: order === 'release_d' ? productUrl(value.sourceId, order) : value.sourceUrl,
        coverUrl: typeof value.coverUrl === 'string' ? value.coverUrl : fallbackCoverUrl(value.sourceId),
        preorder: Boolean(value.preorder),
      }];
    });
    if (items.length) cache.set(order, { updatedAt: entry.updatedAt, items });
  }
}
async function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    restoreCache(JSON.parse(await readFile(cacheFile, 'utf8')) as Record<string, CachedEntry>);
  } catch { /* No previous cache is normal on the first app run. */ }
  for (const legacyFile of legacyCacheFiles) {
    try { restoreCache(JSON.parse(await readFile(legacyFile, 'utf8')) as Record<string, CachedEntry>, true); } catch { /* Legacy cache is optional. */ }
  }
}
async function saveCache() {
  if (!persistentCache) return;
  const snapshot = JSON.stringify(Object.fromEntries(cache));
  cacheSave = cacheSave.catch(() => undefined).then(async () => {
    await mkdir(dirname(cacheFile), { recursive: true });
    const temporaryFile = `${cacheFile}.tmp`;
    await writeFile(temporaryFile, snapshot, 'utf8');
    await rename(temporaryFile, cacheFile);
  });
  await cacheSave;
}
async function fetchRankingPage(url: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'NoVoice/1.0 discovery' }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`DLsite 返回 ${response.status}`);
      return response.text();
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error('DLsite 榜单暂时不可用');
}
async function enrichVoiceActors(order: DiscoveryOrder, items: Discovery[]) {
  const current = voiceEnrichments.get(order);
  if (current) return current;
  const task = (async () => {
  const now = Date.now();
  const candidates = items.filter(item => !item.voiceActors && (item.voiceActorsRetryAt === null || item.voiceActorsRetryAt <= now)).slice(0, 20);
  if (!candidates.length) return false;
  let next = 0;
  // DLsite's detail pages throttle parallel requests much more aggressively
  // than ranking pages. A single durable queue fills the daily cache steadily.
  const workers = Array.from({ length: 1 }, async () => {
    while (next < candidates.length) {
      const item = candidates[next++];
      try {
        const voiceActors = await fetchDlsiteVoiceActors(item.sourceUrl);
        if (voiceActors) {
          item.voiceActors = voiceActors;
          item.voiceActorsRetryAt = null;
        } else {
          // The page was reached but has no credited voice actor; recheck on
          // the next daily rank refresh in case a pre-release page changes.
          item.voiceActorsRetryAt = Date.now() + dayMs;
        }
      } catch {
        // DLsite can intermittently time out. Retry later without making every
        // browser refresh repeatedly hit the upstream detail page.
        item.voiceActorsRetryAt = Date.now() + 15 * 60_000;
      }
      item.voiceActorsFetchedAt = Date.now();
      item.voiceActorsLookupVersion = 3;
    }
  });
  await Promise.all(workers);
  return true;
  })().finally(() => voiceEnrichments.delete(order));
  voiceEnrichments.set(order, task);
  return task;
}
async function refreshDiscovery(order: DiscoveryOrder) {
  const current = refreshes.get(order);
  if (current) return current;
  const task = (async () => {
  const url = `${sourceUrls[order]}/per_page/100`;
  const items: Discovery[] = [];
  // DLsite can cap a result page below the requested page size. Continue over
  // following pages until the full ranking is available, without retaining
  // duplicate works from redirects or repeated cards.
  try {
    for (let page = 1; page <= 5 && items.length < 100; page++) {
      const html = await fetchRankingPage(page === 1 ? url : `${url}/page/${page}`);
      const before = items.length;
      for (const match of html.matchAll(/<dl class="work_img_main">([\s\S]*?)<\/dl>/gi)) {
        const card = match[1];
        const sourceId = (/(?:product_id\/|data-product_id=["'])(RJ\d+)/i.exec(card)?.[1] ?? '').toUpperCase();
        const title = clean(/<dd class="work_name">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i.exec(card)?.[1] ?? '');
        const image = /(?:(?:https?:)?\/\/img\.dlsite\.jp\/(?:modpub|resize)\/images2\/(?:work|ana)\/[^'"\s]+?_img_main(?:_[^'"\s]+)?\.(?:jpg|jpeg|png|webp))/i.exec(card)?.[0];
        const voiceActors = voiceActorsFromTitle(title);
        if (!sourceId || !title || items.some(item => item.sourceId === sourceId)) continue;
        const coverUrl = image ? image.replace(/^\/\//, 'https://').replace('/resize/', '/modpub/').replace(/_img_main_[^/.]+(?=\.(?:jpg|jpeg|png|webp)$)/i, '_img_main') : fallbackCoverUrl(sourceId);
        items.push({ sourceId, title, voiceActors, voiceActorsFetchedAt: null, voiceActorsRetryAt: voiceActors ? null : 0, voiceActorsLookupVersion: 3, sourceUrl: productUrl(sourceId, order), coverUrl, preorder: /予告|pre.?order/i.test(card) });
      }
      if (items.length === before) break;
    }
  } catch (error) {
    throw error;
  }
  const value = { updatedAt: Date.now(), items: items.slice(0, 100) };
  cache.set(order, value);
  await saveCache();
  if (persistentCache) {
    void enrichVoiceActors(order, value.items).then(changed => changed ? saveCache() : undefined).catch(() => undefined);
  } else {
    // Keep test and development calls deterministic; production refreshes in
    // the background so a user request never waits on detail-page I/O.
    await enrichVoiceActors(order, value.items);
  }
  return value;
  })().finally(() => refreshes.delete(order));
  refreshes.set(order, task);
  return task;
}

export async function discovery(order: DiscoveryOrder, limit = 20) {
  await loadCache();
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const previous = cache.get(order);
  if (previous && Date.now() - previous.updatedAt < dayMs) {
    const voiceActorsPending = previous.items.slice(0, 20).some(item => !item.voiceActors && (item.voiceActorsRetryAt === null || item.voiceActorsRetryAt <= Date.now()));
    if (voiceActorsPending) {
      void enrichVoiceActors(order, previous.items).then(changed => changed ? saveCache() : undefined).catch(() => undefined);
    }
    return { ...previous, items: previous.items.slice(0, safeLimit), cached: true, voiceActorsPending };
  }
  try {
    const value = await refreshDiscovery(order);
    return { ...value, items: value.items.slice(0, safeLimit), cached: false, voiceActorsPending: value.items.slice(0, 20).some(item => !item.voiceActors && (item.voiceActorsRetryAt === null || item.voiceActorsRetryAt <= Date.now())) };
  } catch (error) {
    if (previous) return { ...previous, items: previous.items.slice(0, safeLimit), cached: true, stale: true };
    throw error;
  }
}

/** Refreshes stale rankings on the server, independent of open browser tabs. */
export function scheduleDiscoveryRefresh() {
  if (refreshSchedulerStarted) return;
  refreshSchedulerStarted = true;
  const refreshStaleRankings = () => void Promise.allSettled([
    discovery('trend', 100),
    discovery('release_d', 100),
    discovery('subtitle', 100),
  ]);
  refreshStaleRankings();
  const timer = setInterval(refreshStaleRankings, 60 * 60_000);
  timer.unref();
}
