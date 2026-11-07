import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHOTS, fillShots } from '../public/_shared/mogugi/shots.js';

test('every shot is a themed SVG', () => {
  assert.deepEqual(Object.keys(SHOTS).sort(), ['battle', 'battle-mini', 'char', 'items', 'log']);
  for (const [key, draw] of Object.entries(SHOTS)) {
    const svg = draw();
    assert.ok(svg.startsWith('<svg'), key);
    assert.ok(!/(fill|stroke)="#/.test(svg), `${key}: colours come from CSS variables`);
  }
});

test('fillShots fills each [data-shot] element', () => {
  const els = [{ dataset: { shot: 'log' }, innerHTML: '' }, { dataset: { shot: 'nope' }, innerHTML: 'keep' }];
  fillShots({ querySelectorAll: (sel) => (sel === '[data-shot]' ? els : []) });
  assert.ok(els[0].innerHTML.startsWith('<svg'));
  assert.equal(els[1].innerHTML, 'keep');
});
