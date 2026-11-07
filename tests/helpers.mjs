import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function fakeStorage(init = {}) {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

export function throwingStorage() {
  return {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
  };
}

export function fakeMedia(matches) {
  const listeners = [];
  return {
    matches,
    addEventListener: (_type, fn) => listeners.push(fn),
    set(value) { this.matches = value; listeners.forEach((fn) => fn({ matches: value })); },
  };
}

export function loadTheme({ storage = fakeStorage(), prefersLight = false } = {}) {
  const media = fakeMedia(prefersLight);
  const events = [];
  const context = {
    localStorage: storage,
    matchMedia: () => media,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
    document: {
      documentElement: { dataset: {} },
      dispatchEvent: (e) => { events.push(e); return true; },
    },
  };
  context.globalThis = context;
  const src = readFileSync(new URL('../public/_shared/theme.js', import.meta.url), 'utf8');
  vm.runInNewContext(src, context);
  return { T: context.MoguTheme, dataset: context.document.documentElement.dataset, media, events, storage };
}
