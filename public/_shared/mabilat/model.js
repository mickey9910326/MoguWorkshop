// mabilat's display rules, kept identical to the original page so the
// numbers and colours mean the same thing after the move.

export { escapeHtml } from '../mogugi/releases.js';

// Peak level by peaks per 1000 successful pings, independent of window size
// and ping interval.
export const LEVELS = [
  { max: 1, cls: 'good', label: '穩定', range: '< 1‰' },
  { max: 3, cls: 'warning', label: '偶爾', range: '1–3‰' },
  { max: 5, cls: 'serious', label: '頻繁', range: '3–5‰' },
  { max: Infinity, cls: 'critical', label: '嚴重', range: '≥ 5‰' },
];
// The permille legend shows ranges only; grades on this page come from the score.
export const LEVEL_RANGES = LEVELS.map(({ cls, range }) => ({ cls, range }));

// Hourly score: mabilat sends the value, level and rule; the page only maps
// levels to the shared status colours.
export const SCORE_CLS = { good: 'good', normal: 'normal', laggy: 'serious', bad: 'critical', na: 'na' };
// Level wording is page copy; mabilat only decides the level key.
export const SCORE_LABEL = { good: '良好', normal: '普通', laggy: '微卡', bad: '糟糕', na: '樣本不足' };
export function scoreView(s) {
  if (!s) return { cls: 'na', label: '載入中', text: '–' };
  return { cls: SCORE_CLS[s.level] || 'na', label: SCORE_LABEL[s.level] || s.label, text: s.value == null ? '–' : s.value.toFixed(1) };
}
export function scoreLegend(rule) {
  const lv = rule?.levels || [];
  return lv.map((l, i) => ({
    cls: SCORE_CLS[l.key] || 'na',
    label: SCORE_LABEL[l.key] || l.label,
    range: i === 0 ? `≥ ${l.min}` : i === lv.length - 1 ? `< ${lv[i - 1].min}` : `${l.min}–${lv[i - 1].min}`,
  }));
}

// Level key for a bare score value (heatmap cells), using the API's thresholds.
export function scoreLevelOf(v, rule) {
  if (v == null || !rule?.levels?.length) return 'na';
  return (rule.levels.find((l) => v >= l.min) || rule.levels[rule.levels.length - 1]).key;
}

// Overview grid: one row per channel number (CH1–CH13, then HOUSE), one cell
// per server in the given order; a server without that channel gives null.
const chOrder = (ch) => (ch === 'HOUSE' ? 99 : Number(ch.replace(/\D/g, '')) || 98);
export function overviewRows(channels, servers) {
  const names = [...new Set(channels.map((c) => c.channel))].sort((a, b) => chOrder(a) - chOrder(b));
  return names.map((channel) => ({
    channel,
    cells: servers.map((s) => channels.find((c) => c.server === s && c.channel === channel) || null),
  }));
}

// Points each part took off the score, scaled to a full window like the API does.
export function scoreParts(s, rule) {
  if (!s || !rule || !s.n || s.value == null) return null;
  const f = (rule.window_min * 120) / s.n;
  return { hp: +((s.d / rule.k) * f).toFixed(1), sp: +((s.s / rule.k2) * f).toFixed(1) };
}

// Plain-text lines explaining the score, built from the API's rule so the
// numbers on the page always match what mabilat computes.
export function scoreExplain(rule) {
  if (!rule) return [];
  const { window_min: w, start_ms: st, cap_ms: cap, slow_ms: sl, k, k2, min_samples: min } = rule;
  const full = w * 120;
  const levels = scoreLegend(rule).map((l) => `${l.label} ${l.range}`).join('、');
  return [
    `只看近 ${w} 分鐘，與上方選的時間範圍無關，每 5 秒更新。`,
    `HighPing：每次 PING 超過 ${st} ms 的部分加總，超過 ${cap} ms 的以 ${cap} ms 計。`,
    `SlowPing：每次 PING 落在 ${sl}–${st} ms 時，超出 ${sl} ms 的部分加總。`,
    `分數 = 100 − (HighPing ÷ ${k} + SlowPing ÷ ${k2}) × ${full.toLocaleString('en-US')} ÷ PING 次數，最低 0 分；` +
      `${full.toLocaleString('en-US')} 是 ${w} 分鐘每 0.5 秒一次的滿額次數。`,
    `換算：一次 ≥ ${cap} ms 的爆PING 約扣 ${((cap - st) / k).toFixed(1)} 分，一次 30 ms 約扣 ${((30 - st) / k).toFixed(1)} 分；` +
      `約 5.8 ms 的 SlowPing 佔一成時約扣 ${((full * 0.1 * (5.8 - sl)) / k2).toFixed(1)} 分。`,
    `等級：${levels}。`,
    `近 ${w} 分鐘成功的 PING 少於 ${min.toLocaleString('en-US')} 次時不給分（顯示「樣本不足」）。`,
  ];
}

export const cellPermille =(m) => (m.n ? 1000 * m.peaks / m.n : null);
export const permilleLevel = (v) => LEVELS.find((l) => v < l.max);

// Peak count per heatmap cell in four steps; wider cells get wider steps.
export const pkSteps = (bucket) => (bucket > 60 ? [1, 3, 6, 10] : [1, 2, 3, 4]);
export const pkLabels = (bucket) => (bucket > 60 ? ['1–2', '3–5', '6–9', '≥ 10'] : ['1', '2', '3', '≥ 4']);
export function pkIndex(n, bucket) {
  const s = pkSteps(bucket);
  let i = 0;
  while (i < s.length && n >= s[i]) i++;
  return i;
}

export const P95_BREAKS = [4, 6, 10, 20, 50, 100];
export const P95_LABELS = ['< 4', '4–6', '6–10', '10–20', '20–50', '50–100', '≥ 100'];
export function p95Index(v) {
  let i = 0;
  while (i < P95_BREAKS.length && v >= P95_BREAKS[i]) i++;
  return i;
}

export const fmt = (v, d = 2) => (v == null ? '–' : v.toFixed(d));

export const winLabel = (v) => (v >= 1440 ? '近一天' : `近 ${v} 分鐘`);

export function clampMinutes(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 60;
  return Math.min(1440, Math.max(1, Math.round(n)));
}

export const overviewUrl = (minutes) => `api/overview?minutes=${clampMinutes(minutes)}`;

// A slow reply for a window the user has already left must not be drawn.
// The loading reply carries no minutes and always counts.
export const isCurrentReply = (data, minutes) => data.minutes == null || data.minutes === minutes;
