import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, MIN_SAMPLES, P95_BREAKS, P95_LABELS, peakLevel, permilleLevel, cellPermille,
  pkSteps, pkLabels, pkIndex, p95Index, fmt, niceMax, ticks, winLabel, clampMinutes, overviewUrl, escapeHtml,
} from '../public/_shared/mabilat/model.js';

test('constants match mabilat', () => {
  assert.deepEqual(LEVELS.map((l) => [l.max, l.cls, l.label, l.range]), [
    [1, 'good', '穩定', '< 1‰'], [3, 'warning', '偶爾', '1–3‰'], [5, 'serious', '頻繁', '3–5‰'], [Infinity, 'critical', '嚴重', '≥ 5‰'],
  ]);
  assert.equal(MIN_SAMPLES, 600);
  assert.deepEqual(P95_BREAKS, [4, 6, 10, 20, 50, 100]);
  assert.deepEqual(P95_LABELS, ['< 4', '4–6', '6–10', '10–20', '20–50', '50–100', '≥ 100']);
});

test('peakLevel thresholds and insufficient samples', () => {
  const at = (pm, n = 1000) => peakLevel({ peak_permille: pm, n }).cls;
  assert.equal(at(0), 'good');
  assert.equal(at(0.99), 'good');
  assert.equal(at(1), 'warning');
  assert.equal(at(2.99), 'warning');
  assert.equal(at(3), 'serious');
  assert.equal(at(5), 'critical');
  assert.equal(at(50), 'critical');
  assert.deepEqual(peakLevel({ peak_permille: 0, n: 599 }), { cls: 'na', label: '樣本不足' });
  assert.equal(at(0, 600), 'good');
  assert.equal(peakLevel({ peak_permille: null, n: 5000 }).cls, 'na');
});

test('cell permille and its level', () => {
  assert.equal(cellPermille({ n: 0, peaks: 0 }), null);
  assert.equal(cellPermille({ n: 2000, peaks: 3 }), 1.5);
  assert.equal(permilleLevel(1.5).cls, 'warning');
});

test('peak colour steps depend on bucket size', () => {
  assert.deepEqual(pkSteps(60), [1, 2, 3, 4]);
  assert.deepEqual(pkSteps(600), [1, 3, 6, 10]);
  assert.deepEqual(pkLabels(60), ['1', '2', '3', '≥ 4']);
  assert.deepEqual(pkLabels(300), ['1–2', '3–5', '6–9', '≥ 10']);
  assert.deepEqual([0, 1, 2, 3, 4, 9].map((n) => pkIndex(n, 60)), [0, 1, 2, 3, 4, 4]);
  assert.deepEqual([0, 2, 3, 5, 6, 10].map((n) => pkIndex(n, 600)), [0, 1, 2, 2, 3, 4]);
});

test('p95 colour steps', () => {
  assert.deepEqual([0, 3.9, 4, 5.9, 6, 10, 20, 49, 50, 100, 400].map(p95Index), [0, 0, 1, 1, 2, 3, 4, 4, 5, 6, 6]);
});

test('fmt shows a dash for missing values', () => {
  assert.equal(fmt(null), '–');
  assert.equal(fmt(undefined), '–');
  assert.equal(fmt(3.14159), '3.14');
  assert.equal(fmt(3.14159, 1), '3.1');
});

test('axis helpers', () => {
  assert.equal(niceMax(4), 5);
  assert.equal(niceMax(37), 50);
  assert.equal(niceMax(6200), 7000);
  assert.deepEqual(ticks(50), [0, 10, 20, 30, 40, 50]);
});

test('window labels and the overview url', () => {
  assert.equal(winLabel(15), '近 15 分鐘');
  assert.equal(winLabel(1440), '近一天');
  assert.equal(clampMinutes(0), 1);
  assert.equal(clampMinutes(99999), 1440);
  assert.equal(clampMinutes('abc'), 60);
  assert.equal(overviewUrl(30), 'api/overview?minutes=30');
  assert.equal(overviewUrl(5000), 'api/overview?minutes=1440');
});

test('escapeHtml covers attribute quotes', () => {
  assert.equal(escapeHtml(`<b a="1">'&`), '&lt;b a=&quot;1&quot;&gt;&#39;&amp;');
});
