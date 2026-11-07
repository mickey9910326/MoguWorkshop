import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NAV_ITEMS } from '../public/_shared/nav.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const HOST = 'mabinogi.elden-mogu.com';

// Paths on this host that are served by something other than this site.
export const ALLOWED_ORIGIN_PATHS = ['/mabilat/'];

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
  return (JSON.parse(text).routes || []).map((r) => (typeof r === 'string' ? r : r.pattern));
}

test('there are pages to check', () => {
  assert.deepEqual(pages.map((p) => p.path).sort(), ['/', '/doll/']);
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
  for (const text of ['魔古工坊', 'mogugi', 'mabilat', '人偶傷害計算機', '加入伺服器', 'https://discord.gg/pJQsN4HgsD']) {
    assert.ok(home.includes(text), `home: ${text}`);
  }
  const doll = pages.find((p) => p.path === '/doll/').html;
  for (const text of ['人偶傷害計算機', '到 Discord 追蹤進度']) {
    assert.ok(doll.includes(text), `doll: ${text}`);
  }
});

test('wrangler routes cover every page path and nothing broader than allowed', () => {
  const routes = readRoutes();
  assert.ok(!routes.includes(`${HOST}/*`), 'must not take over the whole host');
  for (const r of routes.filter((r) => r.includes('*'))) {
    assert.equal(r, `${HOST}/_shared/*`, `wildcard route not allowed: ${r}`);
  }
  if (routes.length === 0) return;
  for (const { path } of pages) {
    assert.ok(routes.includes(HOST + path), `missing route for ${path}`);
  }
});
