import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState, step, INTERVAL_MS } from '../public/_shared/mogugi/showcase.js';

test('rotates every 6 seconds by default', () => {
  assert.equal(INTERVAL_MS, 6000);
});

test('tick advances and wraps around', () => {
  let s = initialState(3);
  s = step(s, { type: 'tick' });
  assert.equal(s.index, 1);
  s = step(step(s, { type: 'tick' }), { type: 'tick' });
  assert.equal(s.index, 0);
});

test('tick does nothing while paused, and resumes after', () => {
  let s = step(initialState(3), { type: 'pause' });
  assert.equal(step(s, { type: 'tick' }).index, 0);
  s = step(s, { type: 'resume' });
  assert.equal(step(s, { type: 'tick' }).index, 1);
});

test('choosing a tab shows it and stops auto rotation for good', () => {
  let s = step(initialState(5), { type: 'select', index: 3 });
  assert.equal(s.index, 3);
  assert.equal(s.auto, false);
  s = step(step(s, { type: 'resume' }), { type: 'tick' });
  assert.equal(s.index, 3);
});

test('reduced motion never auto rotates', () => {
  const s = initialState(3, { reducedMotion: true });
  assert.equal(s.auto, false);
  assert.equal(step(s, { type: 'tick' }).index, 0);
});

test('select clamps out-of-range indexes', () => {
  assert.equal(step(initialState(3), { type: 'select', index: 9 }).index, 2);
  assert.equal(step(initialState(3), { type: 'select', index: -1 }).index, 0);
});

test('prev/next keys move with wrap and stop rotation', () => {
  let s = step(initialState(3), { type: 'prev' });
  assert.equal(s.index, 2);
  assert.equal(s.auto, false);
  assert.equal(step(s, { type: 'next' }).index, 0);
});
