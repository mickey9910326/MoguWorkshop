import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RELEASES_URL, GITHUB_RELEASES, parseReleases, taipeiDate, escapeHtml,
  renderNotes, downloadHtml, changelogHtml, unavailableHtml, loadReleases,
} from '../public/_shared/mogugi/releases.js';

const CDN = 'https://cdn.elden-mogu.com/mogugi';

function rel(tag, { r2 = true, publishedAt = '2026-11-05T16:57:54Z', body = '- x' } = {}) {
  const v = tag.slice(1);
  return {
    tag, publishedAt, body,
    url: `https://github.com/irusan-fanclub/mogugi/releases/tag/${tag}`,
    exe: r2 ? { name: `mogugi_${v}.exe`, url: `${CDN}/${tag}/mogugi_${v}.exe` } : null,
    zip: r2 ? { name: `mogugi_${v}.zip`, url: `${CDN}/${tag}/mogugi_${v}.zip` } : null,
  };
}

test('constants', () => {
  assert.equal(RELEASES_URL, 'https://cdn.elden-mogu.com/mogugi/releases.json');
  assert.equal(GITHUB_RELEASES, 'https://github.com/irusan-fanclub/mogugi/releases');
});

test('parseReleases rejects missing or empty data', () => {
  assert.equal(parseReleases(null), null);
  assert.equal(parseReleases({}), null);
  assert.equal(parseReleases({ releases: [] }), null);
  assert.equal(parseReleases({ releases: [{ tag: 1 }] }), null);
});

test('parseReleases drops download links outside the cdn and bad github urls', () => {
  const bad = rel('v0.6.1');
  bad.exe.url = 'https://evil.example/x.exe';
  bad.url = 'javascript:alert(1)';
  const [r] = parseReleases({ schema: 1, releases: [bad] });
  assert.equal(r.exe, null);
  assert.equal(r.zip.url, `${CDN}/v0.6.1/mogugi_0.6.1.zip`);
  assert.equal(r.url, GITHUB_RELEASES);
});

test('parseReleases keeps valid entries and drops invalid ones', () => {
  const list = parseReleases({ releases: [rel('v0.6.1'), { tag: 'v0.6.0' }, rel('v0.5.7', { r2: false })] });
  assert.deepEqual(list.map((r) => r.tag), ['v0.6.1', 'v0.5.7']);
  assert.equal(list[1].exe, null);
});

test('taipeiDate shows the Taipei calendar date', () => {
  assert.equal(taipeiDate('2026-11-05T16:57:54Z'), '2026-11-06');
  assert.equal(taipeiDate('2026-10-29T14:13:40Z'), '2026-10-29');
});

test('escapeHtml escapes markup characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;');
});

test('renderNotes renders headings, lists, bold and signature', () => {
  const html = renderNotes('# MOGUGI v0.6.1\n\n### 🖥️ Overlay\n- a **b**\n- c\n\n*by 魔古*');
  assert.ok(!html.includes('MOGUGI v0.6.1'), html);
  assert.ok(html.includes('<h4>🖥️ Overlay</h4>'), html);
  assert.ok(html.includes('<ul><li>a <strong>b</strong></li><li>c</li></ul>'), html);
  assert.ok(html.includes('<p class="sig">by 魔古</p>'), html);
});

test('renderNotes keeps a later top-level heading', () => {
  assert.ok(renderNotes('intro\n# Later').includes('<h4>Later</h4>'));
});

test('renderNotes shows markup and links as plain text', () => {
  const html = renderNotes('<script>alert(1)</script>\n- <img src=x onerror=1>\n[x](javascript:alert(1))');
  assert.ok(!html.includes('<script'), html);
  assert.ok(!html.includes('<img'), html);
  assert.ok(!html.includes('href='), html);
  assert.ok(html.includes('&lt;script&gt;'), html);
});

test('downloadHtml with mirror links', () => {
  const html = downloadHtml(rel('v0.6.1'));
  for (const s of ['v0.6.1', '2026-11-06', '下載 exe', '下載 zip', '下載走台灣有節點的鏡像。無法下載時，請改用 ',
    `${CDN}/v0.6.1/mogugi_0.6.1.exe`, `${CDN}/v0.6.1/mogugi_0.6.1.zip`]) {
    assert.ok(html.includes(s), s);
  }
  assert.ok(!html.includes('載不動'));
});

test('downloadHtml without mirror links only offers GitHub', () => {
  const html = downloadHtml(rel('v0.5.4', { r2: false }));
  assert.ok(!html.includes('cdn.elden-mogu.com'), html);
  assert.ok(html.includes('到 GitHub 下載'), html);
  assert.ok(html.includes('https://github.com/irusan-fanclub/mogugi/releases/tag/v0.5.4'), html);
});

test('changelogHtml opens only the newest and limits the count', () => {
  const list = Array.from({ length: 12 }, (_, i) => rel(`v0.${20 - i}.0`));
  const html = changelogHtml(list, 8);
  assert.equal(html.split('<details').length - 1, 8);
  assert.equal(html.split('<details class="rel" open').length - 1, 1);
  assert.ok(html.indexOf('<details class="rel" open') === html.indexOf('<details'));
  assert.ok(html.includes('所有版本（GitHub）'));
});

test('changelogHtml escapes release body via renderNotes', () => {
  const html = changelogHtml([rel('v0.6.1', { body: '<b>x</b>' })]);
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'), html);
});

test('unavailableHtml points to GitHub', () => {
  const html = unavailableHtml();
  assert.ok(html.includes('暫時讀不到版本資料'));
  assert.ok(html.includes(GITHUB_RELEASES));
});

test('loadReleases fetches without browser cache', async () => {
  let seen;
  const list = await loadReleases(async (url, opts) => {
    seen = { url, opts };
    return { ok: true, json: async () => ({ releases: [rel('v0.6.1')] }) };
  });
  assert.equal(seen.url, RELEASES_URL);
  assert.deepEqual(seen.opts, { cache: 'no-store' });
  assert.equal(list[0].tag, 'v0.6.1');
});

test('loadReleases returns null on any failure', async () => {
  assert.equal(await loadReleases(async () => { throw new Error('net'); }), null);
  assert.equal(await loadReleases(async () => ({ ok: false, json: async () => ({}) })), null);
  assert.equal(await loadReleases(async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } })), null);
  assert.equal(await loadReleases(async () => ({ ok: true, json: async () => ({ releases: [] }) })), null);
});
