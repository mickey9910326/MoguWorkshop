import {
  LEVEL_RANGES, P95_LABELS, cellPermille, permilleLevel, pkLabels, pkIndex, p95Index,
  fmt, winLabel, overviewUrl, escapeHtml, isCurrentReply, scoreView, scoreLegend,
} from './model.js';

// Live latency page for mabilat. Data comes from the same-origin, relative
// api/overview (proxied to mabilat through the tunnel); nothing else is sent.
const POLL_MS = 5000;
const SERVERS = ['全部', '娜歐', '貝婷', '愛麗沙'];
const WINDOWS = [15, 30, 60, 1440];
const STATUS_TEXT = { up: '連線中', timeout: '逾時', down: '中斷' };
const pkVar = (n, bucket) => `var(--pk-${pkIndex(n, bucket)})`;
// 近一天每格 5～10 分鐘，改用爆PING 機率（‰）依等級由綠到紅；一小時以內每格樣本太少，維持次數
const dayMode = () => bucketOf() > 60;

const store = {
  get(k, d) { try { const v = localStorage.getItem('mabilat.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mabilat.' + k, JSON.stringify(v)); } catch {} },
};
const state = {
  server: store.get('server', '娜歐'),
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

const visible = () => (state.data ? state.data.channels : []).filter(c => state.server === '全部' || c.server === state.server);
const bucketOf = () => (state.data && state.data.bucket_s) || 60;
const timeLabel = (t, bucket) => `${hhmm(t)}${bucket > 60 ? `–${hhmm(t + bucket)}` : ''}`;

const p95Var = v => `var(--p95-${p95Index(v)})`;
const levelFill = l => l.cls === 'good' ? 'var(--heat-good)' : `var(--${l.cls})`;

// 通用熱度圖：一列一個頻道、一格一個時段；color(m) 回傳背景色或 null
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
      const bg = m.n > 0 ? color(m) : null;
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
      const c = byIp[x.dataset.ip], m = c.minutes[+x.dataset.i], t = start + (+x.dataset.i) * bucket;
      showTip(`<b>${esc(c.server)} ${esc(c.channel)}</b> <span class="t">${timeLabel(t, bucket)}</span><br>` +
        (m.n ? tipBody(m) + '<br>' : '沒有成功的 PING<br>') +
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
    m => `爆PING <b>${m.peaks}</b> 次（${fmt(cellPermille(m), 2)}‰）· p50 ${fmt(m.p50)} ms`, legend);
}

function renderHeat95(chs) {
  const bucket = bucketOf();
  $('p95-title').textContent = bucket > 60 ? `每 ${bucket / 60} 分鐘 p95` : '每分鐘 p95';
  renderGrid($('heat95'), $('legend95'), chs,
    m => m.p95 == null ? null : p95Var(m.p95),
    m => `p95 <b>${fmt(m.p95)} ms</b> · p50 ${fmt(m.p50)} ms`,
    P95_LABELS.map((l, i) => `<span><span class="sw" style="background:var(--p95-${i})"></span>${l} ms</span>`).join(''));
}

// 卡片走勢線：每個時段的 p50
function spark(c) {
  const vals = c.minutes.map(m => m.p50);
  const ok = vals.filter(v => v != null);
  if (ok.length < 2) return '<svg></svg>';
  const lo = Math.min(...ok), hi = Math.max(...ok), span = hi - lo || 1, W = 100, H = 22, n = vals.length;
  let d = '', pen = false;
  vals.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    const x = (i / (n - 1)) * W, y = H - 3 - ((v - lo) / span) * (H - 6);
    d += `${pen ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`; pen = true;
  });
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--series-1)" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function renderLvlLegend() {
  $('lvl-legend').innerHTML = scoreLegend(state.data && state.data.score_rule)
    .map(l => `<span class="lvl ${l.cls}"><i></i>${l.label} ${l.range}</span>`).join('') +
    `<span class="lvl na"><i></i>樣本不足</span>`;
}

const scoreTag = c => { const v = scoreView(c.score); return `<span class="lvl ${v.cls}"><i></i>${v.text} ${esc(v.label)}</span>`; };

function renderTiles(chs) {
  $('tiles').innerHTML = chs.map(c => {
    const l = scoreView(c.score);
    return `
    <div class="tile lvl-${l.cls}">
      <div class="top"><span class="name">${esc(c.server)} ${esc(c.channel)}</span>${c.status === 'up' ? '' : `<span class="status ${c.status}"><i></i>${STATUS_TEXT[c.status]}</span>`}</div>
      <div class="score" title="近 60 分鐘分數"><span class="v">${l.text}</span><span class="lvl ${l.cls}"><i></i>${esc(l.label)}</span></div>
      <div class="meta">p50 <b>${fmt(c.p50)}</b> ms · p95 <b>${fmt(c.p95)}</b> ms</div>
      <div class="peaks" title="每 1000 次 PING 中延遲 ≥ 100 ms 的次數">爆PING率 <b>${fmt(c.peak_permille, 2)}</b>‰（${c.peaks} 次）</div>
      ${spark(c)}
    </div>`;
  }).join('') || `<div class="empty">${loading() ? '載入中…' : '沒有資料'}</div>`;
}

function renderTable(chs) {
  $('table-count').textContent = chs.length ? `${chs.length} 個頻道` : '';
  $('table').innerHTML = '<thead><tr><th>伺服器</th><th>頻道</th><th>狀態</th><th>分數</th><th class="num">平常延遲（p50）</th><th class="num">p95</th><th class="num">爆PING 次數</th></tr></thead><tbody>' +
    chs.map(c => `<tr><td>${esc(c.server)}</td><td>${esc(c.channel)}</td><td>${STATUS_TEXT[c.status]}</td><td>${scoreTag(c)}</td>` +
      `<td class="num">${fmt(c.p50)}</td><td class="num">${fmt(c.p95)}</td><td class="num">${c.peaks}</td></tr>`).join('') + '</tbody>';
}

function render() {
  renderFilters();
  const chs = visible();
  const up = chs.filter(c => c.status === 'up').length;
  const npk = chs.reduce((a, c) => a + c.peaks, 0);
  if (loading()) $('sub').textContent = '伺服器剛重啟，載入資料中，約需一分鐘…';
  else if (state.data) $('sub').textContent = `${winLabel(state.minutes)} · ${up}/${chs.length} 個頻道連線中 · 爆PING ${npk} 次 · 更新於 ${hhmmss(state.data.now)}`;
  renderLvlLegend();
  renderTiles(chs); renderHeat(chs); renderHeat95(chs); renderTable(chs);
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
