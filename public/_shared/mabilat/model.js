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
export function scoreView(s) {
  if (!s) return { cls: 'na', label: '載入中', text: '–' };
  return { cls: SCORE_CLS[s.level] || 'na', label: s.label, text: s.value == null ? '–' : String(Math.floor(s.value)) };
}
export function scoreLegend(rule) {
  const lv = rule?.levels || [];
  return lv.map((l, i) => ({
    cls: SCORE_CLS[l.key] || 'na',
    label: l.label,
    range: i === 0 ? `≥ ${l.min}` : i === lv.length - 1 ? `< ${lv[i - 1].min}` : `${l.min}–${lv[i - 1].min}`,
  }));
}

export const cellPermille = (m) => (m.n ? 1000 * m.peaks / m.n : null);
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
