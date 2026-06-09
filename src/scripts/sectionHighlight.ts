const FADE_IN_MS = 250;
const HOLD_MS = 1400;
const FADE_OUT_MS = 700;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function findOverlay(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#${CSS.escape(id)} .section-highlight`);
}

export function highlightSection(id: string) {
  const overlay = findOverlay(id);
  if (!overlay) return;

  const existing = timers.get(id);
  if (existing) clearTimeout(existing);

  overlay.style.transition = `opacity ${FADE_IN_MS}ms ease-in`;
  overlay.style.opacity = '1';

  timers.set(id, setTimeout(() => {
    overlay.style.transition = `opacity ${FADE_OUT_MS}ms ease-out`;
    overlay.style.opacity = '0';
    timers.delete(id);
  }, HOLD_MS));
}

export function initSectionHighlight() {
  function onHashChange() {
    const id = location.hash.slice(1);
    if (id && findOverlay(id)) highlightSection(id);
  }

  onHashChange();
  window.addEventListener('hashchange', onHashChange);
}
