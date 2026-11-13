import {
  LEVEL_RANGES, P95_LABELS, cellPermille, permilleLevel, pkLabels, pkIndex, p95Index,
  fmt, overviewUrl, escapeHtml, isCurrentReply, scoreView, scoreLegend, scoreExplain, scoreParts, overviewRows, SCORE_LABEL, SCORE_CLS, scoreLevelOf,
  tileHtml, controlTargets, STATUS_TEXT, STAT_MODES, RECENT_MIN, HEAT_WINDOWS, HEAT_METRICS, recentTitle,
} from './model.js';

// Live latency page for mabilat. Data comes from the same-origin
// /api/mabilat/overview (tunnel to mabilat-web); nothing else is sent.
// Scores, tiles and the table always use the last 60 minutes; tiles can also
// show the last 10. The heatmap picks its own window and metric.
const POLL_MS = 5000;
const HEAT_REFRESH_S = 60;   // a window longer than an hour changes slowly; spare mabilat-web
const SERVERS = ['總覽', '娜歐', '貝婷', '愛麗沙'];
const NAMES = ['娜歐', '貝婷', '愛麗沙'];
const SCORE_MIN = 60;

const store = {
  get(k, d) { try { const v = localStorage.getItem('mabilat.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mabilat.' + k, JSON.stringify(v)); } catch {} },
};
const oneOf = (k, items, d) => { const v = store.get(k, d); return items.includes(v) ? v : d; };
const state = {
  server: oneOf('server', SERVERS, '總覽'),
  stat: oneOf('stat', STAT_MODES.map(m => m.v), 'both'),
  heatMin: oneOf('heatMin', HEAT_WINDOWS.filter(w => !w.off).map(w => w.v), 60),
  metric: oneOf('metric', HEAT_METRICS.map(m => m.v), 'score'),
  top: null,      // last 60 minutes: scores, tiles, table, control
  recent: null,   // last RECENT_MIN minutes: tile numbers
  heat: null,     // the heatmap's window (same as top when it is 60)
  heatAt: 0,
};

const $ = id => document.getElementById(id);
const esc = escapeHtml;
const hhmm = t => new Date(t * 1000).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
const hhmmss = t => new Date(t * 1000).toLocaleTimeString('zh-TW', { hour12: false });
const loading = () => state.top && state.top.loading;
const rule = () => state.top && state.top.score_rule;
const emptyText = () => (loading() ? '伺服器剛重啟，載入資料中，約需一分鐘…' : state.top ? '這段時間沒有資料' : '載入中…');

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

function seg(el, items, current, onPick) {
  el.innerHTML = items.map(it => `<button type="button" aria-pressed="${it.v === current}" data-v="${esc(it.v)}"` +
    `${it.off ? ' disabled title="之後提供"' : ''}>${esc(it.l)}</button>`).join('');
  el.querySelectorAll('button:not([disabled])').forEach(b => b.onclick = () => onPick(b.dataset.v));
}
function renderFilters() {
  seg($('f-server'), SERVERS.map(v => ({ v, l: v })), state.server, v => { state.server = v; store.set('server', v); render(); });
  $('stat-ctl').hidden = state.server === '總覽';
  seg($('f-stat'), STAT_MODES, state.stat, v => { state.stat = v; store.set('stat', v); render(); });
  seg($('f-metric'), HEAT_METRICS, state.metric, v => { state.metric = v; store.set('metric', v); renderFilters(); renderHeat(); });
  seg($('f-window'), HEAT_WINDOWS, state.heatMin, v => {
    state.heatMin = +v; store.set('heatMin', +v);
    state.heat = state.heatMin === SCORE_MIN ? state.top : null; state.heatAt = 0;
    renderFilters(); renderHeat(); poll();
  });
}

const pick = d => (d ? d.channels : []).filter(c => state.server === '總覽' || c.server === state.server);

// ---- heatmap: one card, metric and window chosen in its title row ----
const levelFill = l => l.cls === 'good' ? 'var(--heat-good)' : `var(--${l.cls})`;
const scoreFill = cls => cls === 'na' ? 'var(--heat-na)' : cls === 'good' ? 'var(--heat-good)' : `var(--${cls})`;

// One row per channel, one cell per time slot; color(m, c, i, bucket) gives a background or null.
function renderGrid(d, chs, color, tipBody, legendHtml) {
  const el = $('heat'), legendEl = $('legend');
  if (!d || !chs.length) {
    el.innerHTML = `<div class="empty">${d ? emptyText() : '載入中…'}</div>`;
    el.style.gridTemplateColumns = '1fr'; legendEl.innerHTML = ''; return;
  }
  const n = chs[0].minutes.length, start = d.start, bucket = d.bucket_s || 60;
  const labelEvery = bucket <= 60 ? 600 : 7200;
  el.style.gridTemplateColumns = `max-content repeat(${n}, minmax(4px, 1fr))`;
  let html = '';
  for (const c of chs) {
    html += `<div class="lab">${esc(c.server)} ${esc(c.channel)}</div>`;
    c.minutes.forEach((m, i) => {
      const bg = m.n > 0 ? color(m, c, i, bucket) : null;
      html += `<div class="cell${!m.n && m.lost ? ' lost' : ''}" style="${bg ? `background:${bg}` : ''}" data-ip="${esc(c.ip)}" data-i="${i}"></div>`;
    });
  }
  html += '<div></div>';
  for (let i = 0; i < n; i++) {
    const t = start + i * bucket, dt = new Date(t * 1000);
    html += `<div class="axis">${(t - dt.getTimezoneOffset() * 60) % labelEvery === 0 ? hhmm(t) : ''}</div>`;
  }
  el.innerHTML = html;
  const byIp = Object.fromEntries(chs.map(c => [c.ip, c]));
  el.querySelectorAll('.cell').forEach(x => {
    x.onmousemove = e => {
      const i = +x.dataset.i, c = byIp[x.dataset.ip], m = c.minutes[i], t = start + i * bucket;
      showTip(`<b>${esc(c.server)} ${esc(c.channel)}</b> <span class="t">${hhmm(t)}${bucket > 60 ? `–${hhmm(t + bucket)}` : ''}</span><br>` +
        (m.n ? tipBody(m, c, i) + '<br>' : '沒有成功的 PING<br>') +
        `<span class="t">PING ${m.n} 次${m.lost ? `，逾時 ${m.lost}` : ''}</span>`, e.clientX, e.clientY);
    };
    x.onmouseleave = hideTip;
  });
  legendEl.innerHTML = legendHtml + '<span><span class="sw" style="background:repeating-linear-gradient(45deg,var(--lost) 0 2px,transparent 2px 4px)"></span>只有逾時</span>';
}

function renderHeat() {
  const d = state.heat, chs = pick(d), bucket = (d && d.bucket_s) || 60;
  const unit = bucket > 60 ? `${bucket / 60} 分鐘` : '1 分鐘';
  const win = HEAT_WINDOWS.find(w => w.v === state.heatMin).l;
  if (state.metric === 'score') {
    $('heat-title').textContent = '分數熱度圖';
    $('heat-desc').textContent = `${win}，每格 ${unit}；每格是該時段結束時往前 60 分鐘的分數，顏色同上方等級。找「長時間都綠」的頻道，比只看現在的分數穩。`;
    const r = rule(), at = (c, i) => (c.score_series || [])[i] ?? null;
    renderGrid(d, chs, (m, c, i) => scoreFill(SCORE_CLS[scoreLevelOf(at(c, i), r)]),
      (m, c, i) => { const v = at(c, i), k = scoreLevelOf(v, r); return v == null ? `分數 <b>–</b> ${SCORE_LABEL.na}` : `分數 <b>${v.toFixed(1)}</b> ${SCORE_LABEL[k]}`; },
      scoreLegend(r).map(l => `<span><span class="sw" style="background:${scoreFill(l.cls)}"></span>${l.label} ${l.range}</span>`).join('') +
        `<span><span class="sw" style="background:var(--heat-na)"></span>${SCORE_LABEL.na}</span>`);
  } else if (state.metric === 'peaks') {
    // 一小時以內每格樣本太少，顯示次數；更長的窗口每格 5～10 分鐘，改用爆PING 機率（‰）依等級由綠到紅
    const day = bucket > 60;
    $('heat-title').textContent = '爆PING 熱度圖';
    $('heat-desc').textContent = `${win}，每格 ${unit}；${day ? '顏色是爆PING 機率（‰），由綠到紅' : '顏色越深爆PING 越多'}。一整欄同時變紅＝網路共同問題，不是單一頻道。`;
    const legend = day
      ? LEVEL_RANGES.map(l => `<span><span class="sw" style="background:${levelFill(l)}"></span>${l.range}</span>`).join('')
      : '<span><span class="sw" style="background:var(--pk-0)"></span>0 次</span>' +
        pkLabels(bucket).map((l, i) => `<span><span class="sw" style="background:var(--pk-${i + 1})"></span>${l} 次</span>`).join('');
    renderGrid(d, chs, (m, c, i, b) => day ? levelFill(permilleLevel(cellPermille(m))) : `var(--pk-${pkIndex(m.peaks, b)})`,
      m => `爆PING <b>${m.peaks}</b> 次（${fmt(cellPermille(m), 2)}‰）‧ p50 ${fmt(m.p50)} ms`, legend);
  } else {
    $('heat-title').textContent = 'p95 熱度圖';
    $('heat-desc').textContent = `${win}，每格 ${unit}；95% 的 PING 低於這個值，顏色越深越慢，看平常延遲穩不穩。爆PING 請切到爆PING。`;
    renderGrid(d, chs, m => m.p95 == null ? null : `var(--p95-${p95Index(m.p95)})`,
      m => `p95 <b>${fmt(m.p95)} ms</b> ‧ p50 ${fmt(m.p50)} ms`,
      P95_LABELS.map((l, i) => `<span><span class="sw" style="background:var(--p95-${i})"></span>${l} ms</span>`).join(''));
  }
}

// ---- scores and tiles ----
const recentOf = c => (state.recent && !state.recent.loading ? state.recent.channels.find(x => x.ip === c.ip) || null : null);

function renderLvlLegend() {
  $('lvl-legend').innerHTML = scoreLegend(rule())
    .map(l => `<span class="lvl ${l.cls}"><i></i>${l.label} ${l.range}</span>`).join('') +
    `<span class="lvl na"><i></i>${SCORE_LABEL.na}</span>`;
}

function renderExplain() {
  const lines = scoreExplain(rule());
  $('score-explain').innerHTML = lines.map(l => `<li>${esc(l)}</li>`).join('') || '<li>載入中…</li>';
}

function renderOverview(chs) {
  const chip = c => {
    if (!c) return '<span class="ov-none">–</span>';
    const v = scoreView(c.score), recent = recentTitle(recentOf(c));
    const title = `${c.server} ${c.channel} 近 60 分鐘分數${recent ? `\n${recent}` : ''}`;
    return `<span class="chip lvl-${v.cls}" title="${esc(title)}"><span class="v">${v.text}</span><span class="l">${esc(v.label)}</span></span>`;
  };
  $('tiles').innerHTML = '<div class="scroll-x"><table class="ov"><thead><tr><th>頻道</th>' + NAMES.map(n => `<th>${esc(n)}</th>`).join('') + '</tr></thead><tbody>' +
    overviewRows(chs, NAMES).map(r => `<tr><td class="ch">${esc(r.channel)}</td>${r.cells.map(c => `<td>${chip(c)}</td>`).join('')}</tr>`).join('') +
    '</tbody></table></div>';
}

function renderTiles(chs) {
  const ov = state.server === '總覽';
  $('tiles').className = ov ? 'ov-wrap' : 'tiles';
  if (!chs.length) { $('tiles').innerHTML = `<div class="empty">${emptyText()}</div>`; return; }
  if (ov) { renderOverview(chs); return; }
  $('tiles').innerHTML = chs.map(c => tileHtml(c, rule(), { stat: state.stat, recent: recentOf(c) })).join('');
}

function renderTable(chs) {
  const part = (c, k) => { const pp = scoreParts(c.score, rule()); return pp ? `−${pp[k].toFixed(1)}` : '–'; };
  const tag = c => { const v = scoreView(c.score); return `<span class="lvl ${v.cls}"><i></i>${v.text} ${esc(v.label)}</span>`; };
  $('table-count').textContent = chs.length ? `${chs.length} 個頻道` : '';
  $('table').innerHTML = '<thead><tr><th>伺服器</th><th>頻道</th><th>狀態</th><th>分數</th><th class="num">HP 扣分</th><th class="num">SP 扣分</th><th class="num">p50</th><th class="num">p95</th><th class="num">爆PING 次數</th></tr></thead><tbody>' +
    chs.map(c => `<tr><td>${esc(c.server)}</td><td>${esc(c.channel)}</td><td>${STATUS_TEXT[c.status]}</td><td>${tag(c)}</td>` +
      `<td class="num">${part(c, 'hp')}</td><td class="num">${part(c, 'sp')}</td>` +
      `<td class="num">${fmt(c.p50)}</td><td class="num">${fmt(c.p95)}</td><td class="num">${c.peaks}</td></tr>`).join('') + '</tbody>';
}

// Control points: always tiles, whatever server or overview is picked; hidden when the API has none.
function renderControl() {
  const cs = controlTargets(state.top);
  $('control-card').hidden = !cs.length;
  $('control-tiles').innerHTML = cs.map(c => tileHtml(c, rule(), { control: true })).join('');
}

function render() {
  renderFilters();
  const chs = pick(state.top);
  if (loading()) $('sub').textContent = '伺服器剛重啟，載入資料中，約需一分鐘…';
  else if (state.top) $('sub').textContent = `更新於 ${hhmmss(state.top.now)}`;
  renderLvlLegend(); renderExplain();
  renderTiles(chs); renderHeat(); renderTable(chs); renderControl();
}

// A failed poll keeps the last good data on screen and shows why; the next
// successful poll clears the message.
async function get(minutes) {
  const r = await fetch(overviewUrl(minutes));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  if (!data || !Array.isArray(data.channels)) throw new Error('資料格式不正確');
  return data;
}
let retry = null;
async function poll() {
  const want = state.heatMin;
  const heatDue = want !== SCORE_MIN && (!state.heat || Date.now() / 1000 - state.heatAt >= HEAT_REFRESH_S);
  try {
    const [top, recent, heat] = await Promise.all([get(SCORE_MIN), get(RECENT_MIN), heatDue ? get(want) : null]);
    if (isCurrentReply(top, SCORE_MIN)) state.top = top;
    if (isCurrentReply(recent, RECENT_MIN)) state.recent = recent;
    if (state.heatMin === SCORE_MIN) state.heat = state.top;
    else if (heat && state.heatMin === want && isCurrentReply(heat, want) && !heat.loading) { state.heat = heat; state.heatAt = Date.now() / 1000; }
    $('err').textContent = '';
    clearTimeout(retry);
    if (loading()) retry = setTimeout(poll, 3000);
    render();
  } catch (e) {
    $('err').textContent = '無法取得資料：' + e.message;
  }
}

// The buttons sit inside <summary>: keep their clicks from folding the card.
for (const id of ['f-stat', 'f-metric', 'f-window']) $(id).addEventListener('click', e => e.preventDefault());
renderFilters();
renderLvlLegend();
renderHeat();
poll();
setInterval(poll, POLL_MS);
