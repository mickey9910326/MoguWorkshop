import {
  LEVELS, P95_LABELS, peakLevel, cellPermille, permilleLevel, pkLabels, pkIndex, p95Index,
  fmt, niceMax, ticks, winLabel, overviewUrl, escapeHtml,
} from './model.js';

// Live latency page for mabilat. Data comes from the same-origin, relative
// api/overview (proxied to mabilat through the tunnel); nothing else is sent.
const POLL_MS = 5000;
const SERVERS = ['全部', '娜歐', '貝婷', '愛麗沙'];
const WINDOWS = [15, 30, 60, 1440];
const STATUS_TEXT = { up: '連線中', timeout: '逾時', down: '中斷' };
const lvlTag = c => { const l = peakLevel(c); return `<span class="lvl ${l.cls}"><i></i>${l.label}</span>`; };
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
  selected: store.get('selected', null),
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
const selectedChannel = () => (state.data ? state.data.channels : []).find(c => c.ip === state.selected);
function select(ip) { state.selected = ip; store.set('selected', ip); render(); }
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
    html += `<div class="lab${c.ip === state.selected ? ' sel' : ''}" data-ip="${esc(c.ip)}">${esc(c.server)} ${esc(c.channel)}</div>`;
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
  el.querySelectorAll('.lab').forEach(x => x.onclick = () => select(x.dataset.ip));
  el.querySelectorAll('.cell').forEach(x => {
    x.onmousemove = e => {
      const c = byIp[x.dataset.ip], m = c.minutes[+x.dataset.i], t = start + (+x.dataset.i) * bucket;
      showTip(`<b>${esc(c.server)} ${esc(c.channel)}</b> <span class="t">${timeLabel(t, bucket)}</span><br>` +
        (m.n ? tipBody(m) + '<br>' : '沒有成功的 PING<br>') +
        `<span class="t">PING ${m.n} 次${m.lost ? `，逾時 ${m.lost}` : ''}</span>`, e.clientX, e.clientY);
    };
    x.onmouseleave = hideTip;
    x.onclick = () => select(x.dataset.ip);
  });
  legendEl.innerHTML = legendHtml + '<span><span class="sw" style="background:repeating-linear-gradient(45deg,var(--lost) 0 2px,transparent 2px 4px)"></span>只有逾時</span>';
}

function renderHeat(chs) {
  const bucket = bucketOf(), unit = bucket > 60 ? `${bucket / 60} 分鐘` : '分鐘';
  $('heat-title').textContent = dayMode() ? `每 ${unit}爆PING 機率` : '每分鐘爆PING 次數';
  $('heat-unit').textContent = bucket > 60 ? `${bucket / 60} 分鐘` : '一分鐘';
  const legend = dayMode()
    ? LEVELS.map(l => `<span><span class="sw" style="background:${levelFill(l)}"></span>${l.label} ${l.range}</span>`).join('')
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
  $('lvl-legend').innerHTML = LEVELS.map(l => `<span class="lvl ${l.cls}"><i></i>${l.label} ${l.range}</span>`).join('') +
    `<span class="lvl na"><i></i>樣本不足</span>`;
}

function renderTiles(chs) {
  $('tiles').innerHTML = chs.map(c => {
    const l = peakLevel(c);
    return `
    <button type="button" class="tile lvl-${l.cls}" aria-pressed="${c.ip === state.selected}" data-ip="${esc(c.ip)}">
      <div class="top"><span class="name">${esc(c.server)} ${esc(c.channel)}${c.status === 'up' ? '' : ` <span class="status ${c.status}"><i></i>${STATUS_TEXT[c.status]}</span>`}</span>
        <span class="pm ${l.cls}" title="爆PING 機率：每 1000 次 PING 中延遲 ≥ 100 ms 的次數（${l.label}）"><i></i>${fmt(c.peak_permille, 2)}‰</span></div>
      <div class="big">${fmt(c.p50)} <small>ms</small></div>
      <div class="meta">p95 ${fmt(c.p95)} ms${c.loss_pct > 0 ? ` · 遺失 ${fmt(c.loss_pct, 1)}%` : ''}</div>
      <div class="peaks" title="爆PING 次數／成功的 PING 次數">爆PING <b>${c.peaks}</b>／${c.n.toLocaleString('en-US')} 次${c.peaks !== c.peaks_local ? `（全域 ${c.peaks - c.peaks_local}）` : ''}</div>
      ${spark(c)}
    </button>`;
  }).join('') || `<div class="empty">${loading() ? '載入中…' : '沒有資料'}</div>`;
  $('tiles').querySelectorAll('.tile').forEach(el => el.onclick = () => select(el.dataset.ip));
}

// 爆PING 時間軸：一個縱軸（ms）畫 p50；爆PING 以頂端紅點表示，不佔縱軸
function renderTimeline() {
  const box = $('tl-chart'), c = selectedChannel();
  if (!c) {
    $('tl-title').textContent = '爆PING 時間軸'; $('tl-stats').innerHTML = '';
    box.innerHTML = `<div class="empty">${loading() ? '載入中…' : '點選一個頻道'}</div>`; return;
  }
  $('tl-title').textContent = `爆PING 時間軸 · ${c.server} ${c.channel}`;
  $('tl-stats').innerHTML = `<span>爆PING <b>${c.peaks}</b> 次（<b>${fmt(c.peak_permille, 2)}</b>‰）</span><span>p50 <b>${fmt(c.p50)}</b> ms</span><span>p95 <b>${fmt(c.p95)}</b> ms</span><span>PING <b>${c.n.toLocaleString('en-US')}</b> 次</span>`;
  const ms = c.minutes, n = ms.length, bucket = bucketOf(), start = state.data.start;
  const W = box.clientWidth || 800, H = 240, L = 44, R = 12, T = 22, B = 26;
  const p50s = ms.map(m => m.p50).filter(v => v != null);
  const yMax = niceMax(Math.max(5, (p50s.length ? Math.max(...p50s) : 1) * 1.25));
  const X = i => L + (i + 0.5) / n * (W - L - R), Y = v => T + (1 - v / yMax) * (H - T - B);
  let g = '';
  for (const v of ticks(yMax)) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="var(--text-muted)">${v}</text>`;
  const labelEvery = bucket <= 60 ? (state.minutes <= 15 ? 300 : 600) : 7200;
  for (let i = 0; i < n; i++) {
    const t = start + i * bucket, d = new Date(t * 1000);
    if ((t - d.getTimezoneOffset() * 60) % labelEvery === 0) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="11" fill="var(--text-muted)">${hhmm(t)}</text>`;
  }
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--axis)" stroke-width="1"/>`;
  g += `<text x="4" y="11" font-size="11" fill="var(--text-muted)">p50（ms）</text>`;
  let d = '', pen = false;
  ms.forEach((m, i) => {
    if (m.p50 == null) { pen = false; return; }
    d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(m.p50).toFixed(1)}`; pen = true;
  });
  // 有爆PING 的時段畫成背景直條（在折線底下）：一小時以內依次數用紅色階，近一天依機率等級上色
  const colW = (W - L - R) / n;
  let cols = '';
  ms.forEach((m, i) => {
    if (!m.peaks) return;
    const x0 = L + i * colW;
    const fill = dayMode() ? levelFill(permilleLevel(cellPermille(m))) : pkVar(m.peaks, bucket);
    cols += `<rect x="${x0.toFixed(1)}" y="${T}" width="${Math.max(1, colW - 1).toFixed(1)}" height="${(H - B - T).toFixed(1)}" fill="${fill}" fill-opacity="0.35"/>`;
    if (!dayMode() && m.peaks >= 2 && colW >= 10) cols += `<text x="${X(i).toFixed(1)}" y="${T - 6}" text-anchor="middle" font-size="10" fill="var(--text-secondary)">${m.peaks}</text>`;
  });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.server + ' ' + c.channel)} 每個時段的 p50 與爆PING">${cols}${g}` +
    `<path d="${d}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<g id="xh" style="display:none"><line id="xh-l" y1="${T}" y2="${H - B}" stroke="var(--axis)" stroke-width="1"/><circle id="xh-c" r="4" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/></g>` +
    `<rect x="${L}" y="0" width="${W - L - R}" height="${H - B}" fill="transparent" id="hit"/></svg>`;
  const svg = box.querySelector('svg'), hit = svg.querySelector('#hit'), xh = svg.querySelector('#xh');
  hit.onmousemove = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width);
    const i = Math.max(0, Math.min(n - 1, Math.floor((x - L) / (W - L - R) * n)));
    const m = ms[i], t = start + i * bucket;
    xh.style.display = '';
    svg.querySelector('#xh-l').setAttribute('x1', X(i)); svg.querySelector('#xh-l').setAttribute('x2', X(i));
    const cc = svg.querySelector('#xh-c');
    if (m.p50 == null) cc.style.display = 'none'; else { cc.style.display = ''; cc.setAttribute('cx', X(i)); cc.setAttribute('cy', Y(m.p50)); }
    showTip(`<span class="t">${timeLabel(t, bucket)}</span><br>` + (m.n ? `p50 <b>${fmt(m.p50)} ms</b> · p95 ${fmt(m.p95)} ms<br>爆PING <b>${m.peaks}</b> 次` : '沒有成功的 PING') +
      `<br><span class="t">PING ${m.n} 次${m.lost ? `，逾時 ${m.lost}` : ''}${m.n ? `，機率 ${fmt(cellPermille(m), 2)}‰` : ''}</span>`, e.clientX, e.clientY);
  };
  hit.onmouseleave = () => { xh.style.display = 'none'; hideTip(); };
}

function renderTable(chs) {
  $('table-count').textContent = chs.length ? `${chs.length} 個頻道` : '';
  $('table').innerHTML = '<thead><tr><th>伺服器</th><th>頻道</th><th>IP</th><th>狀態</th><th class="num">p50</th><th class="num">p95</th><th class="num">max</th><th class="num">jitter</th><th class="num">PING 次數</th><th class="num">遺失%</th><th>爆PING 等級</th><th class="num">爆PING</th><th class="num">爆PING‰</th><th class="num">伺服器→你</th><th class="num">你→伺服器（疑）</th><th class="num">連線數</th></tr></thead><tbody>' +
    chs.map(c => `<tr><td>${esc(c.server)}</td><td>${esc(c.channel)}</td><td>${esc(c.ip)}</td><td>${STATUS_TEXT[c.status]}</td>` +
      `<td class="num">${fmt(c.p50)}</td><td class="num">${fmt(c.p95)}</td><td class="num">${fmt(c.max)}</td><td class="num">${fmt(c.jitter)}</td>` +
      `<td class="num">${c.n}</td><td class="num">${fmt(c.loss_pct, 1)}</td><td>${lvlTag(c)}</td><td class="num">${c.peaks}</td><td class="num">${fmt(c.peak_permille, 2)}</td>` +
      `<td class="num">${c.peak_kinds.down}</td><td class="num">${c.peak_kinds.up}</td><td class="num">${c.conns}</td></tr>`).join('') + '</tbody>';
}

function renderPeaks() {
  const ps = (state.data ? state.data.peaks : []).filter(p => state.server === '全部' || p.server === state.server);
  $('peaks-count').textContent = ps.length ? `最近 ${ps.length} 筆` : '';
  $('peaks').innerHTML = ps.length ? '<thead><tr><th>時刻</th><th>頻道</th><th class="num">最大延遲</th><th class="num">持續</th><th>掉包方向</th></tr></thead><tbody>' +
    ps.map(p => `<tr data-ip="${esc(p.ip)}" style="cursor:pointer"><td>${hhmmss(p.t)}</td><td>${esc(p.server)} ${esc(p.channel)}${p.global ? '<span class="tag">全域</span>' : ''}</td>` +
      `<td class="num">${fmt(p.max, 1)} ms</td><td class="num">${p.samples > 1 ? `${p.duration_s} 秒（${p.samples} 次 PING）` : '單次'}</td><td>${esc(p.kind_label)}</td></tr>`).join('') + '</tbody>'
    : '<tbody><tr><td class="empty">這段時間沒有爆PING</td></tr></tbody>';
  $('peaks').querySelectorAll('tr[data-ip]').forEach(el => el.onclick = () => select(el.dataset.ip));
}

function renderEvents() {
  const ev = state.data ? state.data.events : [];
  $('events-count').textContent = ev.length ? `${ev.length} 筆` : '';
  const name = { connect: '連線', disconnect: '斷線', error: '錯誤' };
  $('events').innerHTML = ev.map(e => `<li><time>${hhmmss(e.t)}</time>${esc(e.server)} ${esc(e.channel)} · ${esc(name[e.event] || e.event)} <span class="t">${esc(e.detail)}</span></li>`).join('') || '<li>這段時間沒有事件</li>';
}

function render() {
  renderFilters();
  const chs = visible();
  if (state.data && !selectedChannel() && chs.length) state.selected = chs[0].ip;
  const up = chs.filter(c => c.status === 'up').length;
  const npk = chs.reduce((a, c) => a + c.peaks, 0);
  if (loading()) $('sub').textContent = '伺服器剛重啟，載入資料中，約需一分鐘…';
  else if (state.data) $('sub').textContent = `${winLabel(state.minutes)} · ${up}/${chs.length} 個頻道連線中 · 爆PING ${npk} 次 · 更新於 ${hhmmss(state.data.now)}`;
  renderTiles(chs); renderHeat(chs); renderHeat95(chs); renderTimeline(); renderPeaks(); renderTable(chs); renderEvents();
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
addEventListener('resize', () => renderTimeline());
