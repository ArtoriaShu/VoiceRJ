const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const strip = (value: string) => decode(value.replace(/<[^>]+>/g, ''));
const languagePrefix = /^\s*(?:[【\[（(]\s*)?(?:简体中文版|繁体中文版|日本語版|日本語|English\s*(?:ver\.?|Version))(?:\s*[】\]）)]\s*)?/i;

export function normalizeTitle(value: string) {
  let next = value.trim(); let previous = '';
  while (next && next !== previous) { previous = next; next = next.replace(languagePrefix, '').trim(); }
  return next;
}

type AsmrOneApiWork = {
  title?: unknown;
  name?: unknown;
  circle?: { name?: unknown } | null;
  vas?: Array<{ name?: unknown }> | null;
  tags?: Array<{ name?: unknown; i18n?: { 'zh-cn'?: { name?: unknown } } }> | null;
};

async function fetchAsmrOneApi(rjCode: string, sourceUrl: string) {
  const workId = Number(rjCode.replace(/^RJ/i, ''));
  if (!Number.isSafeInteger(workId) || workId < 1) return null;
  const response = await fetch(`https://api.asmr-200.com/api/work/${workId}`, {
    headers: { accept: 'application/json', 'accept-language': 'zh-CN,zh;q=0.9' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const work = await response.json() as AsmrOneApiWork;
  const rawTitle = typeof work.title === 'string' ? work.title.trim() : '';
  if (!rawTitle) return null;
  const tags = [...new Set((work.tags ?? [])
    .map(tag => tag.i18n?.['zh-cn']?.name ?? tag.name)
    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    .map(tag => tag.trim()))].slice(0, 16);
  return {
    sourceUrl,
    rawTitle,
    normalizedTitle: normalizeTitle(rawTitle),
    tags,
    // ASMR.ONE's public payload uses `name` for the circle. `circle` is kept
    // here for compatibility with older mirrors of the endpoint.
    circle: typeof work.name === 'string' ? work.name.trim() || null : typeof work.circle?.name === 'string' ? work.circle.name.trim() || null : null,
    voiceActors: [...new Set((work.vas ?? []).map(item => typeof item.name === 'string' ? item.name.trim() : '').filter(Boolean))].join('、') || null,
  };
}

async function page(url: string, attempts = 2) {
  // Metadata sources intermittently close server-side TLS connections. Detail
  // pages can request a third retry without changing the local-sync behavior.
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'zh-CN,zh;q=0.9,ja;q=0.7,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`来源服务返回 ${response.status}`);
      return response.text();
    } catch (error) { lastError = error; }
    if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw lastError instanceof Error ? lastError : new Error('来源服务暂时不可用');
}

function voiceActorsFromWorkOutline(html: string) {
  const outline = /<table[^>]*id=["']work_outline["'][^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? '';
  const rows = [...outline.matchAll(/<tr[^>]*>\s*<th[^>]*>\s*([\s\S]*?)\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)];
  return rows
    .filter(row => /^(?:声優|声优|CV|配音|声の出演)$/i.test(strip(row[1]!)))
    .flatMap(row => [...row[2]!.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map(link => strip(link[1]!)))
    .filter(Boolean)
    .join('、') || null;
}

/** Reads the official cast from a work or announcement detail page. */
export async function fetchDlsiteVoiceActors(sourceUrl: string) {
  const source = new URL(sourceUrl);
  source.searchParams.set('locale', 'zh_CN');
  try {
    const voiceActors = voiceActorsFromWorkOutline(await page(source.toString(), 3));
    if (voiceActors || !source.pathname.includes('/announce/')) return voiceActors;
  } catch (error) {
    if (!source.pathname.includes('/announce/')) throw error;
  }
  // Some announcement records expose the date and cover there, while the
  // complete cast remains on the corresponding regular work detail page.
  source.pathname = source.pathname.replace('/announce/', '/work/');
  return voiceActorsFromWorkOutline(await page(source.toString(), 3));
}

export async function fetchAsmrOne(rjCode: string) {
  const sourceUrl = `https://www.asmr.one/work/${encodeURIComponent(rjCode)}`;
  // ASMR.ONE's HTML endpoint may reset server-side connections, while its
  // public work endpoint has the canonical Chinese title and localized tags.
  try {
    const result = await fetchAsmrOneApi(rjCode, sourceUrl);
    if (result) return result;
  } catch {
    // Keep HTML parsing as a compatibility fallback for API outages.
  }
  const html = await page(sourceUrl);
  // The work title is inside the Quasar detail column, not necessarily the first H1 in an SSR shell.
  const raw = /<h1[^>]*class=["'][^"']*text-h6[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
    ?? /<div[^>]*class=["'][^"']*col-12[^"']*col-md-8[^"']*["'][^>]*>[\s\S]{0,1800}?<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
    ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
    // The static document reliably carries the work title even when ASMR.ONE's
    // client data has not hydrated its H1 yet.
    ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const rawTitle = raw ? strip(raw).replace(/^RJ\d+\s+/i, '').replace(/\s+-\s+ASMR Online\s*$/i, '').trim() : '';
  const title = rawTitle ? normalizeTitle(rawTitle) : '';
  if (!title) throw new Error('未找到可用的中文标题。');
  const section = /<h1[^>]*[\s\S]*?<\/h1>([\s\S]{0,12000}?)(?:<button[^>]*>\s*<span[^>]*>[^<]*(?:添加到播放列表|预览字幕)|$)/i.exec(html)?.[1] ?? '';
  const tagMatches = [...section.matchAll(/q-chip__content[^>]*>\s*([\s\S]*?)\s*<\/div>/gi)];
  const ignored = new Set(['带字幕', '多语种']);
  const tags = [...new Set(tagMatches.map(match => strip(match[1]!)).filter(tag => tag && !ignored.has(tag) && tag.length <= 40))].slice(0, 16);
  const circle = /text-subtitle1[\s\S]{0,700}?text-grey[^>]*>\s*([\s\S]*?)\s*<\/span>/i.exec(html)?.[1];
  return { sourceUrl, rawTitle, normalizedTitle: title, tags, circle: circle ? strip(circle) : null, voiceActors: null };
}

export async function fetchDlsite(rjCode: string) {
  // DLsite returns translated genres on its Chinese locale, so tags stored in
  // the local library remain useful in a Chinese UI.
  const sourceUrl = `https://www.dlsite.com/maniax/work/=/product_id/${encodeURIComponent(rjCode)}.html?locale=zh_CN`;
  const html = await page(sourceUrl);
  const title = /<h1[^>]*id=["']?work_name["']?[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const circle = /(?:maker_name|circle_name)[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i.exec(html)?.[1];
  const cover = /https?:[^"'\s]+(?:modpub|img\/work)[^"'\s]+\.(?:jpg|jpeg|png|webp)[^"'\s]*/i.exec(html)?.[0];
  const outline = /<table[^>]*id=["']work_outline["'][^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1] ?? '';
  const rows = [...outline.matchAll(/<tr[^>]*>\s*<th[^>]*>\s*([\s\S]*?)\s*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)];
  const voiceActors = voiceActorsFromWorkOutline(html);
  const genreCell = rows.find(row => /^(?:ジャンル|类型|标签)$/i.test(strip(row[1]!)))?.[2] ?? '';
  const tags = [...new Set([...genreCell.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map(match => normalizeDlsiteTag(strip(match[1]!))).filter(Boolean))].slice(0, 12);
  const cleaned = title ? strip(title).replace(/\s*\|\s*DLsite.*$/i, '') : '';
  if (!cleaned) throw new Error('未找到 DLsite 标题。');
  return { sourceUrl, title: cleaned, circle: circle ? strip(circle) : null, voiceActors, coverUrl: cover ?? null, tags };
}

const translatedTags: Record<string, string> = {
  'ASMR': 'ASMR', 'バイノーラル': '双耳录音', '耳かき': '掏耳', '耳舐め': '舔耳',
  '癒し': '治愈', '催眠': '催眠', 'ささやき': '耳语', 'シチュエーション': '情景音声',
  'ロールプレイ': '角色扮演', 'ラブラブ': '恋爱', '日常': '日常', '純愛': '纯爱',
  'ファンタジー': '幻想', 'ダミーヘッドマイク': '假人头麦克风', '全年齢': '全年龄',
  '退廃/背徳/インモラル': '颓废/背德', '寝取られ': '被NTR(苦主视角)', '寝取らせ': '绿奴/被NTR',
  '喘ぎ真似': '模仿娇喘', 'オナサポ': '自慰辅助', 'オホ声': '哦吼淫叫', '言葉責め': '言语刺激',
  '中出し': '内射/中出', '脚': '腿/足', 'インテリ': '知识分子', '浮気': '出轨',
  '快楽堕ち': '沉迷快乐/快乐堕落', 'SM': 'SM', '巨乳': '巨乳', '人妻': '人妻',
};

/** DLsite genres are Japanese; local metadata is intentionally kept in Chinese. */
export function normalizeDlsiteTag(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (translatedTags[normalized]) return translatedTags[normalized];
  // A successful zh_CN response already provides Chinese labels. Never store an
  // untranslated Japanese fallback under the promise of a Chinese tag.
  return /[\u3040-\u30ff]/.test(normalized) ? '' : normalized;
}
