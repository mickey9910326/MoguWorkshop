import { loadReleases, downloadHtml, changelogHtml, unavailableHtml } from './releases.js';

// Screenshots open full size in a dialog; without JS (or <dialog>) the link
// opens the image itself. Esc, or a click anywhere, closes it.
const view = document.querySelector('.zoom-view');
if (view && typeof view.showModal === 'function') {
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a.zoom');
    if (!a || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    const img = document.createElement('img');
    img.src = a.href;
    img.alt = a.querySelector('img')?.alt ?? '';
    view.replaceChildren(img);
    view.showModal();
  });
  view.addEventListener('click', () => view.close());
}

const dl = document.getElementById('dl');
const notes = document.getElementById('notes');
const list = await loadReleases();
if (list) {
  dl.innerHTML = downloadHtml(list[0]);
  notes.innerHTML = changelogHtml(list);
} else {
  dl.innerHTML = unavailableHtml();
  notes.innerHTML = unavailableHtml();
}
