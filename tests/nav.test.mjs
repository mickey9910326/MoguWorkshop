import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_ITEMS, navModel, readCollapsed, DISCORD_URL, THEME_LABEL, COLLAPSE_KEY, itemsHtml, discordItem, BRAND_LOGO } from '../public/_shared/nav.js';
import { fakeStorage, throwingStorage } from './helpers.mjs';

test('navModel marks only the current item', () => {
  const m = navModel('doll');
  assert.deepEqual(m.filter((i) => i.current).map((i) => i.id), ['doll']);
  assert.equal(m.length, 4);
});

test('navModel with unknown id marks nothing', () => {
  assert.equal(navModel('nope').some((i) => i.current), false);
});

test('navModel normalises flags to booleans', () => {
  const home = navModel('home').find((i) => i.id === 'home');
  assert.equal(home.external, false);
  assert.equal(home.dev, false);
});

test('phase-1 links: mogugi external to GitHub releases, mabilat to existing page', () => {
  const by = Object.fromEntries(NAV_ITEMS.map((i) => [i.id, i]));
  assert.deepEqual(NAV_ITEMS.map((i) => i.id), ['home', 'mogugi', 'mabilat', 'doll']);
  assert.equal(by.home.href, '/');
  assert.equal(by.mogugi.href, 'https://github.com/irusan-fanclub/mogugi/releases');
  assert.equal(by.mogugi.external, true);
  assert.equal(by.mabilat.href, '/mabilat/');
  assert.equal(by.doll.href, '/doll/');
  assert.equal(by.doll.dev, true);
  assert.equal(by.doll.name, '人偶計算機');
});

test('readCollapsed', () => {
  assert.equal(COLLAPSE_KEY, 'mw-nav-collapsed');
  assert.equal(readCollapsed(fakeStorage({ 'mw-nav-collapsed': '1' })), true);
  assert.equal(readCollapsed(fakeStorage({ 'mw-nav-collapsed': '0' })), false);
  assert.equal(readCollapsed(fakeStorage({})), false);
  assert.equal(readCollapsed(throwingStorage()), false);
});

test('constants', () => {
  assert.equal(DISCORD_URL, 'https://discord.gg/pJQsN4HgsD');
  assert.deepEqual(THEME_LABEL, { auto: '主題：自動', light: '主題：淺色', dark: '主題：深色' });
});

test('every nav link has an accessible name even when labels are hidden', () => {
  const html = itemsHtml(navModel('home')) + discordItem();
  const links = [...html.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
  assert.equal(links.length, 5);
  for (const a of links) assert.match(a, /aria-label="[^"]+"/, a);
  assert.match(html, /aria-label="mogugi（外部連結）"/);
});

test('brand logo is the 蘑菇雞 image', () => {
  assert.match(BRAND_LOGO, /<img src="\/_shared\/img\/mogu-chicken-64\.png" alt="" width="34" height="34">/);
});
