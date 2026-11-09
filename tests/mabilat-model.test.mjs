import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS, P95_BREAKS, P95_LABELS, permilleLevel, cellPermille,
  pkSteps, pkLabels, pkIndex, p95Index, fmt, winLabel, clampMinutes, overviewUrl, escapeHtml,
  SCORE_CLS, SCORE_LABEL, scoreView, scoreLegend, LEVEL_RANGES, scoreExplain, scoreParts, overviewRows, scoreLevelOf,
} from '../public/_shared/mabilat/model.js';

test('constants match mabilat', () => {
  assert.deepEqual(LEVELS.map((l) => [l.max, l.cls, l.label, l.range]), [
    [1, 'good', '穩定', '< 1‰'], [3, 'warning', '偶爾', '1–3‰'], [5, 'serious', '頻繁', '3–5‰'], [Infinity, 'critical', '嚴重', '≥ 5‰'],
  ]);
  assert.deepEqual(P95_BREAKS, [4, 6, 10, 20, 50, 100]);
  assert.deepEqual(P95_LABELS, ['< 4', '4–6', '6–10', '10–20', '20–50', '50–100', '≥ 100']);
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

test('a reply only counts if it is for the window now selected', async () => {
  const { isCurrentReply } = await import('../public/_shared/mabilat/model.js');
  assert.equal(isCurrentReply({ minutes: 15, channels: [] }, 15), true);
  assert.equal(isCurrentReply({ minutes: 1440, channels: [] }, 15), false);
  assert.equal(isCurrentReply({ loading: true, channels: [] }, 15), true, 'loading reply has no minutes');
});

test('scoreView maps levels and missing values', () => {
  assert.deepEqual(scoreView({ value: 94.9, level: 'normal', label: '普通' }), { cls: 'normal', label: '普通', text: '94.9' });
  assert.equal(scoreView({ value: 84.5, level: 'laggy', label: '微卡' }).text, '84.5');
  assert.equal(scoreView({ value: 69.9, level: 'bad', label: '糟糕' }).text, '69.9');
  assert.deepEqual(scoreView({ value: 60, level: 'bad', label: '糟糕' }), { cls: 'critical', label: '糟糕', text: '60.0' });
  assert.deepEqual(scoreView({ value: 72, level: 'laggy', label: '微卡' }), { cls: 'serious', label: '微卡', text: '72.0' });
  assert.deepEqual(scoreView({ value: null, level: 'na', label: '樣本不足' }), { cls: 'na', label: '樣本不足', text: '–' });
  assert.deepEqual(scoreView(null), { cls: 'na', label: '載入中', text: '–' });
  assert.deepEqual(scoreView(undefined), { cls: 'na', label: '載入中', text: '–' });
  assert.deepEqual(SCORE_CLS, { good: 'good', normal: 'normal', laggy: 'serious', bad: 'critical', na: 'na' });
});

test('scoreLegend comes from the rule', () => {
  const rule = { levels: [{ key: 'good', label: '良好', min: 95 }, { key: 'normal', label: '普通', min: 85 },
    { key: 'laggy', label: '微卡', min: 70 }, { key: 'bad', label: '糟糕', min: 0 }] };
  assert.deepEqual(scoreLegend(rule).map((l) => [l.cls, l.label, l.range]),
    [['good', '良好', '≥ 95'], ['normal', '普通', '85–95'], ['serious', '微卡', '70–85'], ['critical', '糟糕', '< 70']]);
  assert.deepEqual(scoreLegend(null), []);
});

test('permille legend shows ranges only', () => {
  assert.deepEqual(LEVEL_RANGES.map((l) => [l.cls, l.range]),
    [['good', '< 1‰'], ['warning', '1–3‰'], ['serious', '3–5‰'], ['critical', '≥ 5‰']]);
  for (const l of LEVEL_RANGES) assert.equal(l.label, undefined);
});

test('scoreExplain spells out the rule with its own numbers', () => {
  const rule = { window_min: 60, start_ms: 6, cap_ms: 100, slow_ms: 4.3, k: 22, k2: 500, min_samples: 5400,
    levels: [{ key: 'good', label: '良好', min: 95 }, { key: 'normal', label: '普通', min: 85 },
      { key: 'laggy', label: '微卡', min: 70 }, { key: 'bad', label: '糟糕', min: 0 }] };
  const text = scoreExplain(rule).join(' ');
  for (const part of ['HighPing', 'SlowPing', '近 60 分鐘', '超過 6 ms', '100 ms', '4.3', '÷ 22', '÷ 500', '4.3 分', '1.1 分', '5,400', '良好 ≥ 95', '糟糕 < 70']) {
    assert.ok(text.includes(part), part);
  }
  assert.ok(!/卡頓量|慢 ping 量/.test(text));
  assert.deepEqual(scoreExplain(null), []);
});

test('scoreParts turns D and S into points deducted', () => {
  const rule = { window_min: 60, k: 22, k2: 500 };
  // D 440 ms, S 1000 ms over 7200 samples → HighPing 20 points, SlowPing 2 points
  assert.deepEqual(scoreParts({ d: 440, s: 1000, n: 7200, value: 78 }, rule), { hp: 20, sp: 2 });
  // fewer samples scale up to a full hour
  assert.deepEqual(scoreParts({ d: 220, s: 0, n: 5400, value: 92 }, rule), { hp: 13.3, sp: 0 });
  // no score (too few samples) → no breakdown either
  assert.equal(scoreParts({ d: 220, s: 0, n: 3600, value: null }, rule), null);
  assert.equal(scoreParts({ d: 0, s: 0, n: 0 }, rule), null);
  assert.equal(scoreParts(null, rule), null);
  assert.equal(scoreParts({ d: 1, s: 1, n: 10 }, null), null);
});

test('overviewRows lays channels out as CH1–CH13 and HOUSE by server', () => {
  const ch = (server, channel) => ({ server, channel });
  const chans = [ch('貝婷', 'CH2'), ch('娜歐', 'HOUSE'), ch('娜歐', 'CH2'), ch('愛麗沙', 'CH10'), ch('娜歐', 'CH10')];
  const rows = overviewRows(chans, ['娜歐', '貝婷', '愛麗沙']);
  assert.deepEqual(rows.map((r) => r.channel), ['CH2', 'CH10', 'HOUSE']);
  assert.deepEqual(rows[0].cells.map((c) => c && c.server), ['娜歐', '貝婷', null]);
  assert.deepEqual(rows[1].cells.map((c) => c && c.server), ['娜歐', null, '愛麗沙']);
  assert.deepEqual(overviewRows([], ['娜歐']), []);
});

test('level wording comes from the page, not the API', () => {
  assert.deepEqual(SCORE_LABEL, { good: '良好', normal: '普通', laggy: '微卡', bad: '糟糕', na: '樣本不足' });
  assert.equal(scoreView({ value: 97, level: 'good', label: '好' }).label, '良好');
  assert.equal(scoreView({ value: 97, level: 'good' }).label, '良好');
  assert.equal(scoreView({ value: null, level: 'na' }).label, '樣本不足');
  const rule = { levels: [{ key: 'good', label: '好', min: 95 }, { key: 'normal', label: 'x', min: 85 },
    { key: 'laggy', label: 'y', min: 70 }, { key: 'bad', label: 'z', min: 0 }] };
  assert.deepEqual(scoreLegend(rule).map((l) => l.label), ['良好', '普通', '微卡', '糟糕']);
});

test('scoreLevelOf maps a value to the API rule levels', () => {
  const rule = { levels: [{ key: 'good', min: 95 }, { key: 'normal', min: 85 }, { key: 'laggy', min: 70 }, { key: 'bad', min: 0 }] };
  assert.equal(scoreLevelOf(95, rule), 'good');
  assert.equal(scoreLevelOf(94.9, rule), 'normal');
  assert.equal(scoreLevelOf(70, rule), 'laggy');
  assert.equal(scoreLevelOf(0, rule), 'bad');
  assert.equal(scoreLevelOf(null, rule), 'na');
  assert.equal(scoreLevelOf(90, null), 'na');
});

// ---- 小卡（頻道與對照組共用） ----
import { tileHtml, controlTargets, CONTROL_SCORE_NOTE, METHOD_LABEL, STATUS_TEXT } from '../public/_shared/mabilat/model.js';

const TILE_RULE = { window_min: 60, k: 22, k2: 500 };
const TILE_CH = { server: '娜歐', channel: 'CH1', ip: '210.208.80.31', status: 'up', p50: 3.01, p95: 5.43, min: 2.4,
  peaks: 3, peak_permille: 0.42, score: { value: 92.34, level: 'normal', d: 220, s: 0, n: 5400 } };

test('controlTargets tolerates old and empty replies', () => {
  assert.deepEqual(controlTargets({ channels: [] }), []);
  assert.deepEqual(controlTargets({ control: [] }), []);
  assert.deepEqual(controlTargets(null), []);
  assert.deepEqual(controlTargets({ control: 'x' }), []);
  assert.equal(controlTargets({ control: [{ channel: 'a' }] }).length, 1);
});

// 分數 = 100 − HP − SP（API 的算法），扣分條三段加起來剛好 100
const TILE_CH2 = { ...TILE_CH, p99: 8.46, min: 2.32, score: { value: 86.7, level: 'normal', d: 220, s: 0, n: 5400 } };
const lineCount = (h) => (h.match(/\n {6}<div/g) || []).length;

test('channel tile: score, a quiet deduction bar, then two rows of cells', () => {
  const h = tileHtml(TILE_CH2, TILE_RULE);
  assert.equal(lineCount(h), 7);
  assert.match(h, /<div class="tile lvl-normal">/);
  assert.match(h, /<span class="name">娜歐 CH1<\/span>/);
  assert.match(h, /<div class="ln ip">210\.208\.80\.31<\/div>/);   // 頻道只顯示 IP，不標量法
  assert.match(h, /<span class="v">86\.7<\/span><span class="lv">普通<\/span>/);
  assert.match(h, /<div class="unit">延遲 ms<\/div>/);
  for (const [label, v] of [['p50', '3.01'], ['p95', '5.43'], ['p99', '8.46'], ['最小', '2.32']]) {
    assert.match(h, new RegExp(`<div class="c"><span>${label}</span><b>${v.replace('.', '\.')}</b></div>`), label);
  }
  assert.match(h, /<div class="c hot"><span>爆PING<\/span><b>0\.42<small>‰<\/small><\/b><\/div>/);
  assert.match(h, /<div class="c hot"><span>次數<\/span><b>3<\/b><\/div>/);
  assert.match(h, /<div class="dd" title="近 60 分鐘各部分扣的分數：HP −13\.3、SP −0\.0">/);
  assert.match(h, /<div class="dd-l">HP −13\.3 ‧ SP −0\.0<\/div>/);
  assert.match(h, /<i class="k" style="width:86\.7%"><\/i><i class="hp" style="width:13\.3%"><\/i>/);
  assert.match(tileHtml({ ...TILE_CH2, status: 'timeout' }, TILE_RULE), /<span class="status timeout"><i><\/i>逾時<\/span>/);
  assert.equal(STATUS_TEXT.down, '中斷');
});

test('no peaks means no red, and no score keeps an empty deduction row', () => {
  const calm = tileHtml({ ...TILE_CH2, peaks: 0, peak_permille: 0 }, TILE_RULE);
  assert.doesNotMatch(calm, /hot/);
  const na = tileHtml({ ...TILE_CH2, score: { value: null, level: 'na', n: 0, d: 0, s: 0 } }, TILE_RULE);
  assert.equal(lineCount(na), 7);
  assert.match(na, /<div class="dd"><\/div>/);
  const empty = tileHtml({ ...TILE_CH2, p50: null, p95: null, p99: null, min: null, peaks: 0, peak_permille: null }, TILE_RULE);
  assert.match(empty, /<span>p99<\/span><b>–<\/b>/);
  assert.match(empty, /<span>爆PING<\/span><b>–<small>‰<\/small><\/b>/);
});

test('deduction bar never overflows when the deductions pass 100', () => {
  const h = tileHtml({ ...TILE_CH2, score: { value: 0, level: 'bad', d: 2200, s: 50000, n: 7200 } }, TILE_RULE);
  const widths = [...h.matchAll(/width:([\d.]+)%/g)].map((m) => +m[1]);
  assert.ok(widths.reduce((a, b) => a + b, 0) <= 100.05, widths.join(','));
});

test('control tile shows ip, method, min and the reference mark', () => {
  const h = tileHtml({ ...TILE_CH2, server: '對照組', channel: 'HiNet DNS', ip: '168.95.1.1', method: 'dns', min: 1.84 },
    TILE_RULE, { control: true });
  assert.equal(lineCount(h), 7);
  assert.match(h, /<div class="tile ctl lvl-normal">/);
  assert.match(h, /<span class="name">HiNet DNS<\/span>/);
  assert.doesNotMatch(h, /對照組/);
  assert.match(h, /<div class="ln ip">168\.95\.1\.1 ‧ TCP\(DNS\)<\/div>/);
  assert.match(h, /<span>最小<\/span><b>1\.84<\/b>/);
  assert.match(h, /<span class="ref" title="[^"]+">參考<\/span>/);
  assert.ok(h.includes(CONTROL_SCORE_NOTE));
  const icmp = tileHtml({ ...TILE_CH, channel: 'local節點1', ip: '192.168.0.1', method: 'icmp' }, TILE_RULE, { control: true });
  assert.match(icmp, /192\.168\.0\.1 ‧ ICMP/);
  const unknown = tileHtml({ ...TILE_CH, channel: 'x', ip: '1.1.1.1' }, TILE_RULE, { control: true });
  assert.match(unknown, /1\.1\.1\.1 ‧ ICMP/);
  assert.deepEqual(METHOD_LABEL, { icmp: 'ICMP', dns: 'TCP(DNS)' });
});

test('control tile escapes names', () => {
  assert.match(tileHtml({ ...TILE_CH, channel: '<x>', ip: '1.1.1.1' }, TILE_RULE, { control: true }), /&lt;x&gt;/);
});

