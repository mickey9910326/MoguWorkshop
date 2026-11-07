export const DISCORD_URL = 'https://discord.gg/pJQsN4HgsD';
export const COLLAPSE_KEY = 'mw-nav-collapsed';
export const THEME_LABEL = { auto: '主題：自動', light: '主題：淺色', dark: '主題：深色' };

export const NAV_ITEMS = [
  { id: 'home', name: '主頁', href: '/' },
  { id: 'mogugi', name: 'mogugi', href: 'https://github.com/irusan-fanclub/mogugi/releases', external: true },
  { id: 'mabilat', name: 'mabilat', href: '/mabilat/' },
  { id: 'doll', name: '人偶計算機', href: '/doll/', dev: true },
];

export function navModel(current) {
  return NAV_ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    href: item.href,
    external: !!item.external,
    dev: !!item.dev,
    current: item.id === current,
  }));
}

export function readCollapsed(storage) {
  try {
    return storage.getItem(COLLAPSE_KEY) === '1';
  } catch (e) {
    return false;
  }
}

const ICON = {
  home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  mogugi: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
  mabilat: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
  doll: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 12h1M14 12h1M9 16h1M14 16h1"/>',
  discord: '<path d="M7 17c-2 0-4-1-4-1V8c2-2 5-3 5-3l1 2h6l1-2s3 1 5 3v8s-2 1-4 1l-1-2H8z"/><circle cx="9.5" cy="12" r="1"/><circle cx="14.5" cy="12" r="1"/>',
  chev: '<path d="m15 6-6 6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
};

const LOGO =
  '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M2.5 16.5C2.5 8.5 8.6 3.5 16 3.5s13.5 5 13.5 13H2.5z" fill="var(--cap)" stroke="#2a0d0a" stroke-width="1.2"/>' +
  '<circle cx="9" cy="10.5" r="2.2" fill="#fff4e6"/><circle cx="18.5" cy="7.5" r="1.7" fill="#fff4e6"/><circle cx="24" cy="12.5" r="1.5" fill="#fff4e6"/>' +
  '<path d="M9 16.5h14v6.5a7 7 0 0 1-14 0z" fill="#fff4e6" stroke="#2a0d0a" stroke-width="1.2"/><circle cx="13.3" cy="21" r="1.3" fill="#1a1a1a"/>' +
  '<circle cx="18.7" cy="21" r="1.3" fill="#1a1a1a"/><ellipse cx="11.6" cy="23.6" rx="1.3" ry=".8" fill="#ff9d9d"/><ellipse cx="20.4" cy="23.6" rx="1.3" ry=".8" fill="#ff9d9d"/></svg>';

function svg(name) {
  return '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>';
}

function itemsHtml(model) {
  return model
    .map((i) => {
      const attrs = [
        'class="item' + (i.dev ? ' dev' : '') + '"',
        'href="' + i.href + '"',
        'data-name="' + i.name + '"',
        i.current ? 'aria-current="page"' : '',
        i.external ? 'rel="noopener"' : '',
      ].filter(Boolean).join(' ');
      return '<a ' + attrs + '>' + svg(i.id) +
        '<span class="label">' + i.name + (i.external ? ' <span class="ext" aria-label="（外部連結）">↗</span>' : '') + '</span>' +
        (i.dev ? '<span class="soon">開發中</span>' : '') + '</a>';
    })
    .join('');
}

function themeButton() {
  return globalThis.MoguTheme ? '<button type="button" class="item theme-btn"></button>' : '';
}

function discordItem() {
  return '<a class="item" href="' + DISCORD_URL + '" rel="noopener" data-name="Discord">' + svg('discord') + '<span class="label">Discord</span></a>';
}

function safeStorage() {
  try { return globalThis.localStorage; } catch (e) { return null; }
}

function defineEmNav() {
class EmNav extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = '1';
    const current = this.getAttribute('current') || '';
    const model = navModel(current);
    const here = model.find((i) => i.current);
    this.fabIcon = here ? here.id : 'home';

    this.innerHTML =
      '<nav class="rail" aria-label="工具">' +
        '<div class="rail-head"><a class="brand" href="/">' + LOGO + '<b>魔古工坊</b></a>' +
        '<button type="button" class="collapse" aria-label="收合導覽欄" title="收合導覽欄">' + svg('chev') + '</button></div>' +
        itemsHtml(model) + '<div class="grow"></div>' + themeButton() + discordItem() +
      '</nav>' +
      '<div class="scrim" hidden></div>' +
      '<nav class="sheet" id="mw-sheet" aria-label="工具" hidden>' + itemsHtml(model) + '<hr>' + themeButton() + discordItem() + '</nav>' +
      '<button type="button" class="fab" aria-controls="mw-sheet" aria-expanded="false" aria-label="開啟選單">' + svg(this.fabIcon) + '</button>';

    document.documentElement.classList.add('mw-nav-ready');
    const storage = safeStorage();
    this.setCollapsed(storage ? readCollapsed(storage) : false, false);

    this.querySelector('.collapse').addEventListener('click', () => {
      this.setCollapsed(!document.documentElement.classList.contains('mw-collapsed'), true);
    });
    this.querySelector('.fab').addEventListener('click', () => this.setOpen(!this.classList.contains('open')));
    this.querySelector('.scrim').addEventListener('click', () => this.setOpen(false));
    this.querySelectorAll('.sheet a').forEach((a) => a.addEventListener('click', () => this.setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.setOpen(false); });

    this.querySelectorAll('.theme-btn').forEach((b) => b.addEventListener('click', () => globalThis.MoguTheme.cycle()));
    document.addEventListener('mw-themechange', () => this.renderTheme());
    this.renderTheme();
  }

  setCollapsed(collapsed, persist) {
    document.documentElement.classList.toggle('mw-collapsed', collapsed);
    const b = this.querySelector('.collapse');
    const label = collapsed ? '展開導覽欄' : '收合導覽欄';
    b.setAttribute('aria-label', label);
    b.title = label;
    if (persist) {
      try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) {}
    }
  }

  setOpen(open) {
    this.classList.toggle('open', open);
    this.querySelector('.scrim').hidden = !open;
    this.querySelector('.sheet').hidden = !open;
    const fab = this.querySelector('.fab');
    fab.setAttribute('aria-expanded', String(open));
    fab.setAttribute('aria-label', open ? '關閉選單' : '開啟選單');
    fab.innerHTML = svg(open ? 'close' : this.fabIcon);
  }

  renderTheme() {
    if (!globalThis.MoguTheme) return;
    const mode = globalThis.MoguTheme.getMode();
    this.querySelectorAll('.theme-btn').forEach((b) => {
      b.innerHTML = svg(mode) + '<span class="label">' + THEME_LABEL[mode] + '</span>';
      b.dataset.name = THEME_LABEL[mode];
      b.setAttribute('aria-label', THEME_LABEL[mode] + '，點擊切換');
    });
  }
}

customElements.define('em-nav', EmNav);
}

if (globalThis.customElements && !customElements.get('em-nav')) defineEmNav();
