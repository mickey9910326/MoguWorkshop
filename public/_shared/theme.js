(function () {
  var MODES = ['auto', 'light', 'dark'];
  var STORAGE_KEY = 'mw-theme';
  var root = document.documentElement;
  var media = null;
  try { media = globalThis.matchMedia('(prefers-color-scheme: light)'); } catch (e) {}

  function resolveTheme(mode, prefersLight) {
    if (mode === 'light') return 'mist';
    if (mode === 'dark') return 'ink';
    return prefersLight ? 'mist' : 'ink';
  }

  function nextMode(mode) {
    var i = Math.max(MODES.indexOf(mode), 0);
    return MODES[(i + 1) % MODES.length];
  }

  function readMode(storage) {
    try {
      var v = storage.getItem(STORAGE_KEY);
      return MODES.indexOf(v) >= 0 ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function storage() {
    try { return localStorage; } catch (e) { return null; }
  }

  var mode = storage() ? readMode(storage()) : 'auto';

  function apply() {
    var theme = resolveTheme(mode, !!(media && media.matches));
    root.dataset.theme = theme;
    root.dataset.themeMode = mode;
    try {
      document.dispatchEvent(new CustomEvent('mw-themechange', { detail: { mode: mode, theme: theme } }));
    } catch (e) {}
  }

  function cycle() {
    mode = nextMode(mode);
    try { storage().setItem(STORAGE_KEY, mode); } catch (e) {}
    apply();
    return mode;
  }

  if (media && media.addEventListener) {
    media.addEventListener('change', function () { if (mode === 'auto') apply(); });
  }

  globalThis.MoguTheme = {
    MODES: MODES,
    STORAGE_KEY: STORAGE_KEY,
    resolveTheme: resolveTheme,
    nextMode: nextMode,
    readMode: readMode,
    getMode: function () { return mode; },
    cycle: cycle,
  };

  apply();
})();
