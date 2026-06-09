import { highlightSection } from './sectionHighlight';

const FADE_DURATION = 150;
const COPIED_DURATION = 2000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function swapLabel(label: HTMLElement, text: string, onDone?: () => void) {
  label.classList.add('fading');
  setTimeout(() => {
    label.textContent = text;
    label.classList.remove('fading');
    onDone?.();
  }, FADE_DURATION);
}

export function initSectionHeadings() {
  document.querySelectorAll<HTMLButtonElement>('.section-hash').forEach(btn => {
    const section = btn.dataset.section!;
    const label = btn.nextElementSibling as HTMLElement;
    const original = label.textContent!;

    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(`${location.origin}/#${section}`);
      location.hash = section;
      highlightSection(section);

      if (timers.has(section)) {
        clearTimeout(timers.get(section));
        timers.delete(section);
      }

      swapLabel(label, `copied #${section}`, () => {
        timers.set(section, setTimeout(() => {
          swapLabel(label, original);
          timers.delete(section);
        }, COPIED_DURATION));
      });
    });
  });
}
