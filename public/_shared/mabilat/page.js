import {
  LEVEL_RANGES, P95_LABELS, cellPermille, permilleLevel, pkLabels, pkIndex, p95Index,
  fmt, winLabel, overviewUrl, escapeHtml, isCurrentReply, scoreView, scoreLegend, scoreExplain, scoreParts, overviewRows, SCORE_LABEL, SCORE_CLS, scoreLevelOf,
  tileHtml, controlTargets, STATUS_TEXT,
} from './model.js';

// Live latency page for mabilat. Data comes from the same-origin, relative
// api/overview (proxied to mabilat through the tunnel); nothing else is sent.
const POLL_MS = 5000;
const SERVERS = ['總覽', '娜歐', '貝婷', '愛麗沙', '全部'];
const NAMES = ['娜歐', '貝婷', '愛麗沙'];
const WINDOWS = [15, 30, 60, 1440];
const pkVar = (n, bucket) => `var(--pk-${pkIndex(n, bucket)})`;
// 近一天每格 5～10 分鐘，改用爆PING 機率（‰）依等級由綠到紅；一小時以內每格樣本太少，維持次數
const dayMode = () => bucketOf() > 60;

const store = {
  get(k, d) { try { const v = localStorage.getItem('mabilat.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mabilat.' + k, JSON.stringify(v)); } catch {} },
};
const state = {
  server: SERVERS.includes(store.get('server', '總覽')) ? store.get('server', '總覽') : '總覽',
  minutes: WINDOWS.includes(store.get('minutes', 60)) ? store.get('minutes', 60) : 60,
  data: null,
};

const $ = id => document.getElementById(id);
const esc = escapeHtml;
const hhmm = t => new Date(t * 1000).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
const hhmmss = t => new Date(t * 1000).toLocaleTimeString('zh-TW', { hour12: false });
const loading = () => state.data && state.data.loading;

const tip = $('tip');
function showTip(html, x, y) {
  tip.innerHTML = html; tip.style.display = 'block';
  const r = tip.getBoundingClientRect();
  let left = x + 14, top = y + 14;
  if (left + r.width > innerWidth - 8) left = x - r.width - 14;
  if (top + r.height > innerHeight - 8) top = y - r.height - 14;
  tip.style.left = Math.max(8, left) + 'px'; tip.style.top = Math.max(8, top) + 'px';
}
const hideTip = () => { tip.style.display = 'none'; };

function seg(el, items, current, label, onPick) {
  el.innerHTML = items.map(v => `<button type="button" aria-pressed="${v === current}" data-v="${esc(v)}">${esc(label(v))}</button>`).join('');
  el.querySelectorAll('button').forEach(b => b.onclick = () => onPick(b.dataset.v));
}
function renderFilters() {
  seg($('f-server'), SERVERS, state.server, v => v, v => { state.server = v; store.set('server', v); render(); });
  seg($('f-window'), WINDOWS, state.minutes, winLabel, v => { state.minutes = +v; store.set('minutes', +v); renderFilters(); poll(); });
}

const showsAll = () => state.server === '全部' || state.server === '總覽';
const visible = () => (state.data ? state.data.channels : []).filter(c => showsAll() || c.server === state.server);
const bucketOf = () => (state.data && state.data.bucket_s) || 60;
const timeLabel = (t, bucket) => `${hhmm(t)}${bucket > 60 ? `–${hhmm(t + bucket)}` : ''}`;

const p95Var = v => `var(--p95-${p95Index(v)})`;
const levelFill = l => l.cls === 'good' ? 'var(--heat-good)' : `var(--${l.cls})`;

// 通用熱度圖：一列一個頻道、一格一個時段；color(m, c, i) 回傳背景色或 null
function renderGrid(el, legendEl, chs, color, tipBody, legendHtml) {
  if (!chs.length) {
    el.innerHTML = `<div class="empty">${loading() ? '伺服器剛重啟，載入資料中，約需一分鐘…' : '這段時間沒有資料'}</div>`;
    el.style.gridTemplateColumns = '1fr'; legendEl.innerHTML = ''; return;
  }
  const n = chs[0].minutes.length, start = state.data.start, bucket = bucketOf();
  const labelEvery = bucket <= 60 ? 600 : 7200;
  el.style.gridTemplateColumns = `max-content repeat(${n}, minmax(4px, 1fr))`;
  let html = '';
  for (const c of chs) {
    html += `<div class="lab">${esc(c.server)} ${esc(c.channel)}</div>`;
    c.minutes.forEach((m, i) => {
      const bg = m.n > 0 ? color(m, c, i) : null;
      const cls = !m.n && m.lost ? 'cell lost' : 'cell';
      html += `<div class="${cls}" style="${bg ? `background:${bg}` : ''}" data-ip="${esc(c.ip)}" data-i="${i}"></div>`;
    });
  }
  html += '<div></div>';
  for (let i = 0; i < n; i++) {
    const t = start + i * bucket, d = new Date(t * 1000);
    html += `<div class="axis">${(t - d.getTimezoneOffset() * 60) % labelEvery === 0 ? hhmm(t) : ''}</div>`;
  }
  el.innerHTML = html;
  const byIp = Object.fromEntries(chs.map(c => [c.ip, c]));
  el.querySelectorAll('.cell').forEach(x => {
    x.onmousemove = e => {
      const i = +x.dataset.i, c = byIp[x.dataset.ip], m = c.minutes[i], t = start + i * bucket;
      showTip(`<b>${esc(c.server)} ${esc(c.channel)}</b> <span class="t">${timeLabel(t, bucket)}</span><br>` +
        (m.n ? tipBody(m, c, i) + '<br>' : '沒有成功的 PING<br>') +
        `<span class="t">PING ${m.n} 次${m.lost ? `，逾時 ${m.lost}` : ''}</span>`, e.clientX, e.clientY);
    };
    x.onmouseleave = hideTip;
  });
  legendEl.innerHTML = legendHtml + '<span><span class="sw" style="background:repeating-linear-gradient(45deg,var(--lost) 0 2px,transparent 2px 4px)"></span>只有逾時</span>';
}

function renderHeat(chs) {
  const bucket = bucketOf(), unit = bucket > 60 ? `${bucket / 60} 分鐘` : '分鐘';
  $('heat-title').textContent = dayMode() ? `每 ${unit}爆PING 機率` : '每分鐘爆PING 次數';
  $('heat-unit').textContent = bucket > 60 ? `${bucket / 60} 分鐘` : '一分鐘';
  const legend = dayMode()
    ? LEVEL_RANGES.map(l => `<span><span class="sw" style="background:${levelFill(l)}"></span>${l.range}</span>`).join('')
    : '<span><span class="sw" style="background:var(--pk-0)"></span>0 次</span>' +
      pkLabels(bucket).map((l, i) => `<span><span class="sw" style="background:var(--pk-${i + 1})"></span>${l} 次</span>`).join('');
  renderGrid($('heat'), $('legend'), chs,
    m => dayMode() ? levelFill(permilleLevel(cellPermille(m))) : pkVar(m.peaks, bucket),
    m => `爆PING <b>${m.peaks}</b> 次（${fmt(cellPermille(m), 2)}‰）‧ p50 ${fmt(m.p50)} ms`, legend);
}

// 每格是到該時段結束為止的近 60 分鐘分數，顏色用分數等級
const scoreFill = cls => cls === 'na' ? 'var(--heat-na)' : cls === 'good' ? 'var(--heat-good)' : `var(--${cls})`;
function renderHeatScore(chs) {
  const rule = state.data && state.data.score_rule;
  const at = (c, i) => (c.score_series || [])[i] ?? null;
  renderGrid($('heat-score'), $('legend-score'), chs,
    (m, c, i) => scoreFill(SCORE_CLS[scoreLevelOf(at(c, i), rule)]),
    (m, c, i) => {
      const v = at(c, i), key = scoreLevelOf(v, rule);
      return v == null ? `分數 <b>–</b> ${SCORE_LABEL.na}` : `分數 <b>${v.toFixed(1)}</b> ${SCORE_LABEL[key]}`;
    },
    scoreLegend(rule).map(l => `<span><span class="sw" style="background:${scoreFill(l.cls)}"></span>${l.label} ${l.range}</span>`).join('') +
      `<span><span class="sw" style="background:var(--heat-na)"></span>${SCORE_LABEL.na}</span>`);
}

function renderHeat95(chs) {
  const bucket = bucketOf();
  $('p95-title').textContent = bucket > 60 ? `每 ${bucket / 60} 分鐘 p95` : '每分鐘 p95';
  renderGrid($('heat95'), $('legend95'), chs,
    m => m.p95 == null ? null : p95Var(m.p95),
    m => `p95 <b>${fmt(m.p95)} ms</b> ‧ p50 ${fmt(m.p50)} ms`,
    P95_LABELS.map((l, i) => `<span><span class="sw" style="background:var(--p95-${i})"></span>${l} ms</span>`).join(''));
}

function renderLvlLegend() {
  $('lvl-legend').innerHTML = scoreLegend(state.data && state.data.score_rule)
    .map(l => `<span class="lvl ${l.cls}"><i></i>${l.label} ${l.range}</span>`).join('') +
    `<span class="lvl na"><i></i>${SCORE_LABEL.na}</span>`;
}

function renderExplain() {
  const lines = scoreExplain(state.data && state.data.score_rule);
  $('score-explain').innerHTML = lines.map(l => `<li>${esc(l)}</li>`).join('') || '<li>載入中…</li>';
}

const scoreTag = c => { const v = scoreView(c.score); return `<span class="lvl ${v.cls}"><i></i>${v.text} ${esc(v.label)}</span>`; };

function renderOverview(chs) {
  const chip = c => {
    if (!c) return '<span class="ov-none">–</span>';
    const v = scoreView(c.score);
    return `<span class="chip lvl-${v.cls}" title="${esc(c.server)} ${esc(c.channel)} 近 60 分鐘分數"><span class="v">${v.text}</span><span class="l">${esc(v.label)}</span></span>`;
  };
  $('tiles').innerHTML = chs.length
    ? '<div class="scroll-x"><table class="ov"><thead><tr><th>頻道</th>' + NAMES.map(n => `<th>${esc(n)}</th>`).join('') + '</tr></thead><tbody>' +
      overviewRows(chs, NAMES).map(r => `<tr><td class="ch">${esc(r.channel)}</td>${r.cells.map(c => `<td>${chip(c)}</td>`).join('')}</tr>`).join('') +
      '</tbody></table></div>'
    : `<div class="empty">${loading() ? '載入中…' : '沒有資料'}</div>`;
}

function renderTiles(chs) {
  const ov = state.server === '總覽';
  $('tiles').className = ov ? 'ov-wrap' : 'tiles';
  if (ov) { renderOverview(chs); return; }
  const rule = state.data && state.data.score_rule;
  $('tiles').innerHTML = chs.map(c => tileHtml(c, rule)).join('') || `<div class="empty">${loading() ? '載入中…' : '沒有資料'}</div>`;
}

function renderTable(chs) {
  const rule = state.data && state.data.score_rule;
  const part = (c, k) => { const pp = scoreParts(c.score, rule); return pp ? `−${pp[k].toFixed(1)}` : '–'; };
  $('table-count').textContent = chs.length ? `${chs.length} 個頻道` : '';
  $('table').innerHTML = '<thead><tr><th>伺服器</th><th>頻道</th><th>狀態</th><th>分數</th><th class="num">HP 扣分</th><th class="num">SP 扣分</th><th class="num">p50</th><th class="num">p95</th><th class="num">爆PING 次數</th></tr></thead><tbody>' +
    chs.map(c => `<tr><td>${esc(c.server)}</td><td>${esc(c.channel)}</td><td>${STATUS_TEXT[c.status]}</td><td>${scoreTag(c)}</td>` +
      `<td class="num">${part(c, 'hp')}</td><td class="num">${part(c, 'sp')}</td>` +
      `<td class="num">${fmt(c.p50)}</td><td class="num">${fmt(c.p95)}</td><td class="num">${c.peaks}</td></tr>`).join('') + '</tbody>';
}

// Control points: always tiles, whatever server or overview is picked; hidden when the API has none.
function renderControl() {
  const cs = controlTargets(state.data);
  const rule = state.data && state.data.score_rule;
  $('control-card').hidden = !cs.length;
  $('control-tiles').innerHTML = cs.map(c => tileHtml(c, rule, { control: true })).join('');
}

function render() {
  renderFilters();
  const chs = visible();
  if (loading()) $('sub').textContent = '伺服器剛重啟，載入資料中，約需一分鐘…';
  else if (state.data) $('sub').textContent = `更新於 ${hhmmss(state.data.now)}`;
  renderLvlLegend(); renderExplain();
  renderTiles(chs); renderControl(); renderHeatScore(chs); renderHeat(chs); renderHeat95(chs); renderTable(chs);
}

// A failed poll keeps the last good data on screen and shows why; the next
// successful poll clears the message.
let retry = null;
async function poll() {
  try {
    const r = await fetch(overviewUrl(state.minutes));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data || !Array.isArray(data.channels)) throw new Error('資料格式不正確');
    if (!isCurrentReply(data, state.minutes)) return;
    state.data = data;
    $('err').textContent = '';
    clearTimeout(retry);
    if (state.data.loading) retry = setTimeout(poll, 3000);
    render();
  } catch (e) {
    $('err').textContent = '無法取得資料：' + e.message;
  }
}

renderFilters();
renderLvlLegend();
poll();
setInterval(poll, POLL_MS);
