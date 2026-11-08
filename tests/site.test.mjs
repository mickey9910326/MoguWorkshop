import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_ITEMS } from '../public/_shared/nav.js';
import { routeProblems } from './routes.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const HOST = 'mabinogi.elden-mogu.com';

// Paths on this host that are served by something other than this site.
export const ALLOWED_ORIGIN_PATHS = [];

const FOOTER = '魔古工坊 · 非官方玩家工具，與遊戲營運商無關';

function htmlFiles(dir = PUBLIC) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

function urlPath(file) {
  const rel = relative(PUBLIC, file).split(sep).join('/');
  return '/' + rel.replace(/index\.html$/, '');
}

const pages = htmlFiles().map((file) => ({ file, path: urlPath(file), html: readFileSync(file, 'utf8') }));

function resolvesLocally(href) {
  const clean = href.split(/[?#]/)[0];
  if (ALLOWED_ORIGIN_PATHS.includes(clean)) return true;
  const target = join(PUBLIC, clean);
  if (clean.endsWith('/')) return existsSync(join(target, 'index.html'));
  return existsSync(target) && statSync(target).isFile();
}

function readRoutes() {
  const text = readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  return JSON.parse(text).routes || [];
}

test('there are pages to check', () => {
  assert.deepEqual(pages.map((p) => p.path).sort(), ['/', '/doll/', '/mabilat/', '/mogugi/']);
});

test('every page loads theme.js synchronously before site.css, and nav.js as module', () => {
  for (const { path, html } of pages) {
    const theme = html.indexOf('<script src="/_shared/theme.js"></script>');
    const css = html.indexOf('<link rel="stylesheet" href="/_shared/site.css">');
    const head = html.indexOf('</head>');
    assert.ok(theme > 0 && theme < css && css < head, `${path}: theme.js must be a plain script before site.css in <head>`);
    assert.ok(html.includes('<script type="module" src="/_shared/nav.js"></script>'), `${path}: nav.js module`);
  }
});

test('every page has exactly one <em-nav current> naming a nav item', () => {
  const ids = NAV_ITEMS.map((i) => i.id);
  for (const { path, html } of pages) {
    const found = [...html.matchAll(/<em-nav current="([^"]*)">/g)].map((m) => m[1]);
    assert.equal(found.length, 1, `${path}: one em-nav`);
    assert.ok(ids.includes(found[0]), `${path}: em-nav current="${found[0]}"`);
  }
});

test('every page uses the 蘑菇雞 icon for favicon, touch icon and link preview', () => {
  for (const { path, html } of pages) {
    assert.ok(html.includes('<link rel="icon" href="/_shared/img/mogu-chicken-32.png" type="image/png">'), `${path}: favicon`);
    assert.ok(html.includes('<link rel="apple-touch-icon" href="/_shared/img/mogu-chicken-180.png">'), `${path}: touch icon`);
    assert.ok(html.includes('<meta property="og:image" content="https://mabinogi.elden-mogu.com/_shared/img/mogu-chicken-256.png">'), `${path}: og:image`);
  }
});

test('every page has a title with 魔古工坊, viewport-fit=cover and the footer text', () => {
  for (const { path, html } of pages) {
    assert.match(html, /<title>[^<]*魔古工坊[^<]*<\/title>/, `${path}: title`);
    assert.ok(html.includes('viewport-fit=cover'), `${path}: viewport-fit`);
    assert.ok(html.includes(FOOTER), `${path}: footer`);
  }
});

test('every internal href and src resolves to a file in public/ or an allowed origin path', () => {
  for (const { path, html } of pages) {
    for (const m of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      assert.ok(resolvesLocally(m[1]), `${path}: broken link ${m[1]}`);
    }
  }
});

test('NAV_ITEMS internal hrefs resolve the same way', () => {
  for (const item of NAV_ITEMS.filter((i) => !i.external)) {
    assert.ok(resolvesLocally(item.href), `nav ${item.id}: ${item.href}`);
  }
});

test('main content is in the HTML, not injected by JS', () => {
  const home = pages.find((p) => p.path === '/').html;
  for (const text of ['魔古工坊', 'mogugi', 'mabilat', '人偶傷害計算機', '加入伺服器', 'https://discord.gg/AjAuanA8V']) {
    assert.ok(home.includes(text), `home: ${text}`);
  }
  assert.ok(home.includes('傷害計量器，並附有物品索引、狀態機制提醒、戰鬥記錄等功能。'), 'home: mogugi blurb');
  assert.ok(home.includes('試算旋律人偶師的傷害、技能倍率、裝備效益。'), 'home: doll blurb');
  assert.ok(home.includes('src="/_shared/img/mogugi.png"'), 'home: mogugi icon');
  assert.ok(!home.includes('娜歐／貝婷／愛麗沙'), 'home: server eyebrow removed');
  assert.ok(home.includes('<p class="lead">放一些奇怪東西的地方。</p>'), 'home: lead');
  assert.ok(home.includes('<meta name="description" content="放一些奇怪東西的地方。">'), 'home: description');
  assert.ok(home.includes('<meta property="og:description" content="放一些奇怪東西的地方。">'), 'home: og:description');
  const doll = pages.find((p) => p.path === '/doll/').html;
  for (const text of ['人偶傷害計算機', '到 Discord 追蹤進度']) {
    assert.ok(doll.includes(text), `doll: ${text}`);
  }
  assert.ok(doll.includes('<p>試算旋律人偶師的傷害、技能倍率、裝備效益。完成後會在 Discord 公告。</p>'), 'doll: blurb matches home');
  assert.ok(doll.includes('<meta name="description" content="試算旋律人偶師的傷害、技能倍率、裝備效益。開發中。">'), 'doll: description');
  assert.ok(doll.includes('<meta property="og:description" content="試算旋律人偶師的傷害、技能倍率、裝備效益。開發中。">'), 'doll: og:description');
});

test('mogugi release page content is in the HTML', () => {
  const html = pages.find((p) => p.path === '/mogugi/').html;
  assert.match(html, /<title>mogugi・魔古工坊<\/title>/);
  assert.ok(html.includes('<em-nav current="mogugi">'));
  const desc = '瑪奇台服的免費傷害統計工具。只在本機讀取封包，不修改遊戲、不送出任何封包，資料全部留在你的電腦。';
  assert.ok(html.includes(`<meta name="description" content="${desc}">`));
  assert.ok(html.includes(`<meta property="og:description" content="${desc}">`));
  assert.ok(html.includes('<meta property="og:title" content="mogugi・魔古工坊">'));
  for (const text of [
    `<p class="lead">${desc}</p>`,
    '<h2>免費使用・需加入 Discord 啟用</h2>',
    'mogugi 完全免費，不收任何費用。第一次開啟時，需要用 Discord 帳號登入，並加入魔古工坊的 Discord 群組才能啟用。',
    '啟用的效期是 30 天。到期後 mogugi 會請你再用 Discord 登入一次，登入後就能繼續使用，紀錄和設定都會保留；如果那時已經不在群組裡，就無法再啟用。',
    '這樣做是為了避免有人把免費的工具拿去轉賣，也讓版本公告和問題回報集中在同一個地方，減少紛爭。',
    '如果有人向你收費販售 mogugi，那不是我們提供的，請不要付款，並到 Discord 回報。',
    '加入 Discord 群組',
    'https://npcap.com/#download',
    '下載上面的 exe 並執行。',
    '之後每 30 天重新登入一次。',
    '開遊戲、進副本，打完就能在戰鬥分頁看結果。',
    '<h3>傷害統計</h3>', '<h3>戰鬥紀錄</h3>', '<h3>角色與裝備</h3>', '<h3>物品索引</h3>', '<img src="/_shared/mogugi/shots/gear.webp"', '<h3>遊戲內 Overlay <span class="pill dev">測試中</span></h3>',
    '<img src="/_shared/mogugi/shots/battle.webp"', '<img src="/_shared/mogugi/shots/log.webp"',
    '<img src="/_shared/mogugi/shots/items.webp"', '<img src="/_shared/mogugi/shots/overlay.webp"',
    '<script type="module" src="/_shared/mogugi/page.js"></script>',
    '<link rel="stylesheet" href="/_shared/mogugi/mogugi.css">',
  ]) assert.ok(html.includes(text), `mogugi: ${text}`);
  assert.ok(!html.includes('Windows 桌面程式'));
  assert.ok(!html.includes('data-shot'), 'no placeholder drawings left');
  assert.ok(!html.includes('shot-hero') && !html.includes('<figure'), 'no hero screenshot');
  assert.ok(!html.includes('能做什麼'));
  const order = ['id="dl"', '<h2 class="section-title">目前功能</h2>', '免費使用・需加入 Discord 啟用', '開始使用', '更新紀錄'].map((t) => html.indexOf(t));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), `section order ${order}`);
  const shots = [...html.matchAll(/<a class="zoom" href="([^"]+)"[^>]*>\s*<img src="([^"]+)"/g)];
  assert.equal(shots.length, 5, 'every feature screenshot opens full size');
  assert.ok(html.includes('<div class="features" id="features">'), 'showcase hook');
  assert.equal([...html.matchAll(/<div class="card feat" id="feat-[a-z]+">/g)].length, 5, 'each feature has an id');
  for (const [, href, src] of shots) assert.equal(href, src);
  assert.ok(!html.includes('示意圖'), 'real screenshots are not labelled 示意圖');
  for (const m of html.matchAll(/<img [^>]*>/g)) {
    assert.match(m[0], / alt="[^"]+"/, m[0]);
    assert.match(m[0], / width="\d+" height="\d+"/, m[0]);
  }
  for (const id of ['dl', 'notes']) {
    const m = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</div>`).exec(html);
    assert.ok(m && m[1].includes('暫時讀不到版本資料') && m[1].includes('https://github.com/irusan-fanclub/mogugi/releases'), `#${id} fallback`);
  }
});

test('home links the mogugi card to the release page and shows its version from JS', () => {
  const home = pages.find((p) => p.path === '/').html;
  assert.ok(home.includes('<a class="card tool" href="/mogugi/">'));
  assert.ok(!home.includes('href="https://github.com/irusan-fanclub/mogugi/releases"'));
  assert.ok(home.includes('data-mogugi-ver hidden'));
  assert.ok(home.includes('<script type="module" src="/_shared/mogugi/home.js"></script>'));
});

test('mabilat page content is in the HTML', () => {
  const html = pages.find((p) => p.path === '/mabilat/').html;
  assert.match(html, /<title>mabilat 即時延遲・魔古工坊<\/title>/);
  assert.ok(html.includes('<em-nav current="mabilat">'));
  assert.ok(html.includes('<main class="wide">'));
  for (const text of [
    'mabilat 即時延遲',
    '瑪奇台服各頻道的網路延遲，以不登入的 PING 連線量測，每 0.5 秒量測一次。資料來自單一家用網路(中華電信IP)，只代表這條線路，僅供參考',
    '各指標仍在測試中，目前只能反映這條網路線路的狀況，無法用來判斷頻道或伺服器的好壞。',
    '<h2>頻道</h2>', '每分鐘爆PING 次數', '每分鐘 p95', '表格檢視',
    '<link rel="stylesheet" href="/_shared/mabilat/mabilat.css">',
    '<script type="module" src="/_shared/mabilat/page.js"></script>',
  ]) assert.ok(html.includes(text), `mabilat: ${text}`);
  assert.match(html, /id="score-summary"/);
  for (const id of ['timeline', 'tl-chart', 'peaks', 'events']) assert.doesNotMatch(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /爆PING 時間軸|爆PING 紀錄|連線事件/);
  assert.ok(html.includes('近 60 分鐘分數'));
  assert.ok(html.includes('<noscript>'), 'says it needs JS');
});

test('routeProblems rejects a wildcard under /mabilat/', () => {
  const pg = ['/', '/doll/', '/mabilat/', '/mogugi/'];
  const base = [`${HOST}/`, `${HOST}/doll`, `${HOST}/doll/`, `${HOST}/mabilat`, `${HOST}/mabilat/`, `${HOST}/mogugi`, `${HOST}/mogugi/`, `${HOST}/_shared/*`];
  assert.deepEqual(routeProblems(base, pg), []);
  assert.ok(routeProblems([...base, `${HOST}/mabilat/*`], pg).length > 0);
});

test('routeProblems rejects a wildcard under /mogugi/', () => {
  const pagesWithMogugi = ['/', '/doll/', '/mogugi/'];
  const base = [`${HOST}/`, `${HOST}/doll`, `${HOST}/doll/`, `${HOST}/mogugi`, `${HOST}/mogugi/`, `${HOST}/_shared/*`];
  assert.deepEqual(routeProblems(base, pagesWithMogugi), []);
  assert.ok(routeProblems([...base, `${HOST}/mogugi/*`], pagesWithMogugi).length > 0);
});

test('routeProblems accepts exactly the expected route set', () => {
  const ok = [`${HOST}/`, `${HOST}/doll`, `${HOST}/doll/`, `${HOST}/_shared/*`].map((pattern) => ({ pattern, zone_name: 'elden-mogu.com' }));
  assert.deepEqual(routeProblems(ok, ['/', '/doll/']), []);
});

test('routeProblems rejects custom domains, extra paths and missing ones', () => {
  const base = [`${HOST}/`, `${HOST}/doll`, `${HOST}/doll/`, `${HOST}/_shared/*`];
  assert.ok(routeProblems([...base, { pattern: HOST, custom_domain: true }], ['/', '/doll/']).length > 0);
  assert.ok(routeProblems([...base, `${HOST}/health`], ['/', '/doll/']).length > 0);
  assert.ok(routeProblems([...base, `${HOST}/*`], ['/', '/doll/']).length > 0);
  assert.ok(routeProblems(base.filter((r) => r !== `${HOST}/doll`), ['/', '/doll/']).length > 0);
  assert.ok(routeProblems(base.filter((r) => r !== `${HOST}/_shared/*`), ['/', '/doll/']).length > 0);
});

test('wrangler routes are exactly the pages plus /_shared/*', () => {
  const routes = readRoutes();
  assert.deepEqual(routeProblems(routes, pages.map((p) => p.path)), []);
});

const CSS = readFileSync(join(PUBLIC, '_shared', 'site.css'), 'utf8');
function rule(selector) {
  const start = CSS.search(new RegExp('(^|\\n)' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{'));
  if (start < 0) return '';
  return CSS.slice(CSS.indexOf('{', start) + 1, CSS.indexOf('}', start));
}

test('main bottom padding includes the iPhone home-indicator inset', () => {
  assert.match(rule('main'), /padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom\)\)/);
});

test('rail and main respect left/right safe-area insets (landscape notch)', () => {
  assert.match(rule('.rail'), /padding-left:\s*calc\(10px \+ env\(safe-area-inset-left\)\)/);
  assert.match(rule('main'), /safe-area-inset-left/);
  assert.match(rule('main'), /safe-area-inset-right/);
});

test('the hidden attribute wins over component display rules', () => {
  assert.match(CSS, /\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}/);
});

test('dev proxy notes say to start a local mabilat with the /mabilat base path', () => {
  const src = readFileSync(join(ROOT, 'tools', 'dev-server.mjs'), 'utf8');
  assert.match(src, /--base-path \/mabilat/);
});
