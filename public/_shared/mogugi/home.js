import { loadReleases } from './releases.js';

const badge = document.querySelector('[data-mogugi-ver]');
const list = badge && await loadReleases();
if (list) {
  badge.textContent = list[0].tag;
  badge.hidden = false;
}
