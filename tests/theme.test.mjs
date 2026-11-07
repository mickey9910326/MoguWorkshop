import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTheme, fakeStorage, throwingStorage } from './helpers.mjs';

test('resolveTheme maps mode and system preference to a palette', () => {
  const { T } = loadTheme();
  assert.equal(T.resolveTheme('auto', true), 'mist');
  assert.equal(T.resolveTheme('auto', false), 'ink');
  assert.equal(T.resolveTheme('light', false), 'mist');
  assert.equal(T.resolveTheme('dark', true), 'ink');
});

test('nextMode cycles auto→light→dark→auto', () => {
  const { T } = loadTheme();
  assert.equal(T.nextMode('auto'), 'light');
  assert.equal(T.nextMode('light'), 'dark');
  assert.equal(T.nextMode('dark'), 'auto');
  assert.equal(T.nextMode('bogus'), 'light');
});

test('readMode falls back to auto', () => {
  const { T } = loadTheme();
  assert.equal(T.readMode(fakeStorage({ 'mw-theme': 'dark' })), 'dark');
  assert.equal(T.readMode(fakeStorage({ 'mw-theme': 'purple' })), 'auto');
  assert.equal(T.readMode(throwingStorage()), 'auto');
});

test('applies on load from stored mode and system preference', () => {
  const { dataset } = loadTheme({ storage: fakeStorage({ 'mw-theme': 'auto' }), prefersLight: true });
  assert.equal(dataset.theme, 'mist');
  assert.equal(dataset.themeMode, 'auto');
  const dark = loadTheme({ storage: fakeStorage({ 'mw-theme': 'dark' }), prefersLight: true });
  assert.equal(dark.dataset.theme, 'ink');
});

test('cycle persists, applies and dispatches mw-themechange', () => {
  const { T, dataset, events, storage } = loadTheme({ storage: fakeStorage(), prefersLight: false });
  events.length = 0;
  assert.equal(T.cycle(), 'light');
  assert.equal(storage.data['mw-theme'], 'light');
  assert.equal(dataset.theme, 'mist');
  assert.equal(T.getMode(), 'light');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'mw-themechange');
  assert.equal(events[0].detail.mode, 'light');
  assert.equal(events[0].detail.theme, 'mist');
});

test('cycle survives storage that throws', () => {
  const { T, dataset } = loadTheme({ storage: throwingStorage() });
  assert.equal(dataset.theme, 'ink');
  assert.equal(T.cycle(), 'light');
  assert.equal(dataset.theme, 'mist');
});

test('system preference change re-applies only in auto', () => {
  const auto = loadTheme({ prefersLight: true });
  auto.media.set(false);
  assert.equal(auto.dataset.theme, 'ink');

  const light = loadTheme({ storage: fakeStorage({ 'mw-theme': 'light' }), prefersLight: true });
  light.media.set(false);
  assert.equal(light.dataset.theme, 'mist');
});
