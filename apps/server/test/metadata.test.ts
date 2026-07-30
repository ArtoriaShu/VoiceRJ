import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchAsmrOne, fetchDlsite, fetchDlsiteVoiceActors, normalizeTitle } from '../src/metadata.js';
import { discovery } from '../src/discovery.js';

test('normalizes only leading repeated language markers', () => {
  assert.equal(normalizeTitle('【简体中文版】【NTR】标题 日本語版'), '【NTR】标题 日本語版');
  assert.equal(normalizeTitle('English ver. (繁体中文版) Test'), 'Test');
});

test('extracts ASMR.ONE title and DLsite metadata from sanitized server responses', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => new Response(String(url).includes('asmr.one') ? '<h1>【简体中文版】 可用标题</h1>' : '<title>DLsite 标题 | DLsite</title><div class="maker_name"><a>测试社团</a></div><img src="https://img.dlsite.jp/modpub/images2/work/doujin/RJ01100000/RJ01113481_img_main.jpg">', { status: 200 })) as typeof fetch;
  try {
    assert.deepEqual(await fetchAsmrOne('RJ01113481'), { sourceUrl: 'https://www.asmr.one/work/RJ01113481', rawTitle: '【简体中文版】 可用标题', normalizedTitle: '可用标题', tags: [], circle: null, voiceActors: null });
    const result = await fetchDlsite('RJ01113481'); assert.equal(result.sourceUrl, 'https://www.dlsite.com/maniax/work/=/product_id/RJ01113481.html?locale=zh_CN'); assert.equal(result.title, 'DLsite 标题'); assert.equal(result.circle, '测试社团'); assert.match(result.coverUrl ?? '', /modpub/); assert.deepEqual(result.tags, []);
  } finally { globalThis.fetch = original; }
});

test('falls back to ASMR.ONE document title before the client-side H1 is hydrated', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<title>RJ01591275 【简体中文版】客户端尚未载入时仍可同步 - ASMR Online</title>', { status: 200 })) as typeof fetch;
  try {
    const result = await fetchAsmrOne('RJ01591275');
    assert.equal(result.rawTitle, '【简体中文版】客户端尚未载入时仍可同步');
    assert.equal(result.normalizedTitle, '客户端尚未载入时仍可同步');
  } finally { globalThis.fetch = original; }
});

test('prefers ASMR.ONE public data for Chinese tags and title', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    if (String(url).includes('api.asmr-200.com')) return new Response(JSON.stringify({
      title: '【简体中文版】接口标题',
      circle: { name: '测试社团' },
      tags: [{ name: 'Japanese fallback', i18n: { 'zh-cn': { name: '中文标签' } } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('<h1>不应使用的网页标题</h1>', { status: 200 });
  }) as typeof fetch;
  try {
    assert.deepEqual(await fetchAsmrOne('RJ01591275'), {
      sourceUrl: 'https://www.asmr.one/work/RJ01591275', rawTitle: '【简体中文版】接口标题', normalizedTitle: '接口标题', tags: ['中文标签'], circle: '测试社团', voiceActors: null,
    });
  } finally { globalThis.fetch = original; }
});

test('reads ASMR.ONE work-detail h1 and Chinese chips', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<div class="col-12 col-md-8"><h1 class="text-h6 text-weight-regular">【简体中文版】作品中文标题</h1><div class="text-subtitle1"><span class="text-grey"> 中文社团 </span></div><div class="q-chip__content">耳语</div><div class="q-chip__content">带字幕</div><button>添加到播放列表</button></div>', { status: 200 })) as typeof fetch;
  try { assert.deepEqual(await fetchAsmrOne('RJ01591275'), { sourceUrl: 'https://www.asmr.one/work/RJ01591275', rawTitle: '【简体中文版】作品中文标题', normalizedTitle: '作品中文标题', tags: ['耳语'], circle: '中文社团', voiceActors: null }); }
  finally { globalThis.fetch = original; }
});

test('extracts DLsite voices and only the genre row', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(`
    <h1 id="work_name">测试作品</h1><span class="maker_name"><a>测试社团</a></span>
    <table id="work_outline"><tr><th>声優</th><td><a>声优 A</a><a>声优 B</a></td></tr>
    <tr><th>作品形式</th><td><div class="work_genre"><a>ボイス・ASMR</a></div></td></tr>
    <tr><th>ジャンル</th><td><div class="main_genre"><a>耳舐め</a><a>中出し</a></div></td></tr></table>
  `, { status: 200 })) as typeof fetch;
  try {
    const result = await fetchDlsite('RJ01591275');
    assert.equal(result.voiceActors, '声优 A、声优 B');
    assert.deepEqual(result.tags, ['舔耳', '内射/中出']);
  } finally { globalThis.fetch = original; }
});

test('reads the simplified-Chinese 声优 row used on DLsite announcement pages', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response('<table id="work_outline"><tr><th>声优</th><td><a>五十嵐斎</a><a>第二位声优</a></td></tr></table>', { status: 200 })) as typeof fetch;
  try { assert.equal(await fetchDlsiteVoiceActors('https://www.dlsite.com/maniax/announce/=/product_id/RJ01663846.html'), '五十嵐斎、第二位声优'); }
  finally { globalThis.fetch = original; }
});

test('falls back from an announcement page to its work page for the official cast', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => new Response(String(url).includes('/announce/')
    ? '<table id="work_outline"><tr><th>发售日</th><td>2026年07月</td></tr></table>'
    : '<table id="work_outline"><tr><th>声优</th><td><a>官方声优</a></td></tr></table>', { status: 200 })) as typeof fetch;
  try { assert.equal(await fetchDlsiteVoiceActors('https://www.dlsite.com/maniax/announce/=/product_id/RJ01663846.html'), '官方声优'); }
  finally { globalThis.fetch = original; }
});

test('returns 20 shelf entries and 100 detailed ranking entries', async () => {
  const original = globalThis.fetch;
  const cards = Array.from({ length: 100 }, (_, index) => {
    const id = `RJ${String(1600000 + index).padStart(8, '0')}`;
    return `<dl class="work_img_main"><a href="https://www.dlsite.com/maniax/work/=/product_id/${id}.html"></a><img src="//img.dlsite.jp/modpub/images2/work/doujin/RJ01600000/${id}_img_main.jpg"><dd class="work_name"><a>作品 ${index + 1}</a></dd><dd class="maker_name"><a>社团 ${index + 1}</a></dd></dl>`;
  }).join('');
  globalThis.fetch = (async () => new Response(cards, { status: 200 })) as typeof fetch;
  try {
    assert.equal((await discovery('trend', 20)).items.length, 20);
    const ranking = await discovery('trend', 100);
    assert.equal(ranking.items.length, 100);
    assert.equal(ranking.items[99]?.sourceId, 'RJ01600099');
    const latest = await discovery('release_d', 20);
    assert.match(latest.items[0]?.sourceUrl ?? '', /\/maniax\/announce\//);
    const subtitles = await discovery('subtitle', 100);
    assert.equal(subtitles.items.length, 100);
  } finally { globalThis.fetch = original; }
});
