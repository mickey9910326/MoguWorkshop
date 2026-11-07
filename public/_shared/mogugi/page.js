import { loadReleases, downloadHtml, changelogHtml, unavailableHtml } from './releases.js';

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
