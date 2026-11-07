export const RELEASES_URL = 'https://cdn.elden-mogu.com/mogugi/releases.json';
export const GITHUB_RELEASES = 'https://github.com/irusan-fanclub/mogugi/releases';

const CDN_PREFIX = 'https://cdn.elden-mogu.com/';
const GITHUB_PREFIX = 'https://github.com/';

const isStr = (v) => typeof v === 'string' && v !== '';

function asset(a) {
  if (!a || !isStr(a.name) || !isStr(a.url) || !a.url.startsWith(CDN_PREFIX)) return null;
  return { name: a.name, url: a.url };
}

export function parseReleases(data) {
  if (!data || !Array.isArray(data.releases)) return null;
  const list = [];
  for (const r of data.releases) {
    if (!r || !isStr(r.tag) || !isStr(r.publishedAt) || Number.isNaN(Date.parse(r.publishedAt))) continue;
    list.push({
      tag: r.tag,
      publishedAt: r.publishedAt,
      url: isStr(r.url) && r.url.startsWith(GITHUB_PREFIX) ? r.url : GITHUB_RELEASES,
      body: typeof r.body === 'string' ? r.body : '',
      exe: asset(r.exe),
      zip: asset(r.zip),
    });
  }
  return list.length ? list : null;
}

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function taipeiDate(iso) {
  return dateFmt.format(new Date(iso));
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ESC[c]);
}

const inline = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export function renderNotes(md) {
  const out = [];
  let items = [];
  const flush = () => {
    if (items.length) out.push(`<ul>${items.join('')}</ul>`);
    items = [];
  };
  let first = true;
  for (const raw of String(md).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const isFirst = first;
    first = false;
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush();
      if (isFirst && m[1] === '#') continue;
      out.push(`<h4>${inline(m[2])}</h4>`);
    } else if ((m = /^[-*]\s+(.*)$/.exec(line))) {
      items.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = /^\*([^*].*[^*]|[^*])\*$/.exec(line)) || (m = /^_(.+)_$/.exec(line))) {
      flush();
      out.push(`<p class="sig">${escapeHtml(m[1])}</p>`);
    } else {
      flush();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  flush();
  return out.join('');
}

const link = (href, text, cls) =>
  `<a${cls ? ` class="${cls}"` : ''} href="${escapeHtml(href)}" rel="noopener">${text}</a>`;

export function downloadHtml(r) {
  const date = taipeiDate(r.publishedAt);
  const head = `<div class="dl-head"><div><div class="eyebrow">最新版本</div><div class="ver">${escapeHtml(r.tag)}</div></div>`
    + `<time datetime="${date}">${date} 發佈</time></div>`;
  const btns = [];
  if (r.exe) btns.push(link(r.exe.url, '下載 exe <small>直接執行</small>', 'btn primary'));
  if (r.zip) btns.push(link(r.zip.url, '下載 zip <small>壓縮檔</small>', btns.length ? 'btn' : 'btn primary'));
  if (!btns.length) {
    return `${head}<div class="dl-btns">${link(r.url, '到 GitHub 下載', 'btn primary')}</div>`;
  }
  return `${head}<div class="dl-btns">${btns.join('')}</div>`
    + `<p class="dl-meta">下載走台灣有節點的鏡像。載不動時改用 ${link(r.url, 'GitHub release')}，內容相同。</p>`;
}

export function changelogHtml(list, max = 8) {
  const items = list.slice(0, max).map((r, i) => {
    const links = [];
    if (r.exe) links.push(link(r.exe.url, 'exe'));
    if (r.zip) links.push(link(r.zip.url, 'zip'));
    links.push(link(r.url, 'GitHub'));
    return `<details class="rel"${i === 0 ? ' open' : ''}><summary><b>${escapeHtml(r.tag)}</b>`
      + `<span>${taipeiDate(r.publishedAt)}</span></summary><div class="rel-body">${renderNotes(r.body)}`
      + `<div class="rel-links">${links.join('')}</div></div></details>`;
  });
  return items.join('') + `<p class="all-rel">${link(GITHUB_RELEASES, '所有版本（GitHub）›')}</p>`;
}

export function unavailableHtml() {
  return `<p class="unavailable">暫時讀不到版本資料，請到 ${link(GITHUB_RELEASES, 'GitHub releases')} 下載。</p>`;
}

export async function loadReleases(fetchFn = globalThis.fetch) {
  try {
    const res = await fetchFn(RELEASES_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    return parseReleases(await res.json());
  } catch {
    return null;
  }
}
