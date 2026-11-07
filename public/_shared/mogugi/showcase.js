// Turns the stacked feature cards into one frame with tabs that rotates on
// its own. Rotation pauses while the pointer or focus is inside, stops for
// good once someone picks a tab, and never starts under reduced motion.
// Without JS the cards simply stay stacked.

export const INTERVAL_MS = 6000;

export function initialState(n, { reducedMotion = false } = {}) {
  return { index: 0, n, auto: !reducedMotion, paused: false };
}

export function step(s, action) {
  const at = (i) => ({ ...s, index: i, auto: false });
  switch (action.type) {
    case 'tick':
      return s.auto && !s.paused ? { ...s, index: (s.index + 1) % s.n } : s;
    case 'select':
      return at(Math.min(s.n - 1, Math.max(0, action.index)));
    case 'next':
      return at((s.index + 1) % s.n);
    case 'prev':
      return at((s.index - 1 + s.n) % s.n);
    case 'pause':
      return { ...s, paused: true };
    case 'resume':
      return { ...s, paused: false };
    default:
      return s;
  }
}

export function mountShowcase(root, { interval = INTERVAL_MS, reducedMotion = false } = {}) {
  const panels = [...root.querySelectorAll(':scope > .feat')];
  if (panels.length < 2) return;
  let state = initialState(panels.length, { reducedMotion });

  const tabs = document.createElement('div');
  tabs.className = 'sc-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', '目前功能');
  const buttons = panels.map((panel, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sc-tab';
    b.id = `${panel.id}-tab`;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', panel.id);
    const h3 = panel.querySelector('h3');
    b.textContent = h3.firstChild.textContent.trim();
    const pill = h3.querySelector('.pill');
    if (pill) b.append(' ', pill.cloneNode(true));
    b.addEventListener('click', () => render(step(state, { type: 'select', index: i })));
    // The progress bar under the active tab is the timer: when its animation
    // ends, move on. Pausing the animation therefore pauses the rotation.
    b.addEventListener('animationend', () => { if (i === state.index) render(step(state, { type: 'tick' })); });
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', b.id);
    tabs.append(b);
    return b;
  });
  tabs.addEventListener('keydown', (e) => {
    const type = { ArrowRight: 'next', ArrowLeft: 'prev' }[e.key];
    if (!type) return;
    e.preventDefault();
    render(step(state, { type }));
    buttons[state.index].focus();
  });
  root.classList.add('showcase');
  root.style.setProperty('--sc-interval', `${interval}ms`);
  root.prepend(tabs);

  function render(next) {
    const moved = next.index !== state.index;
    state = next;
    root.classList.toggle('sc-auto', state.auto);
    root.classList.toggle('sc-paused', state.paused);
    buttons.forEach((b, i) => {
      const on = i === state.index;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      // Restart the progress bar animation on the newly active tab.
      if (on && moved) { b.classList.remove('on'); void b.offsetWidth; }
      b.classList.toggle('on', on);
      panels[i].hidden = !on;
    });
  }

  const pause = () => render(step(state, { type: 'pause' }));
  const resume = () => render(step(state, { type: 'resume' }));
  root.addEventListener('pointerenter', pause);
  root.addEventListener('pointerleave', resume);
  root.addEventListener('focusin', pause);
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) resume(); });
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));

  render(state);
}
