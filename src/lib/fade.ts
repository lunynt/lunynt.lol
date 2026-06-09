const FADE_MS = 200;

const pendingHides = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

function cancelPendingHide(el: HTMLElement) {
  const timer = pendingHides.get(el);
  if (timer) {
    clearTimeout(timer);
    pendingHides.delete(el);
  }
}

export function fadeIn(el: HTMLElement) {
  cancelPendingHide(el);
  el.classList.remove('hidden');
  el.getBoundingClientRect();
  el.classList.remove('opacity-0');
}

export function fadeOut(el: HTMLElement) {
  el.classList.add('opacity-0');
  cancelPendingHide(el);
  pendingHides.set(el, setTimeout(() => {
    pendingHides.delete(el);
    el.classList.add('hidden');
  }, FADE_MS));
}

export function fadeOutRemove(el: HTMLElement) {
  el.classList.add('opacity-0');
  cancelPendingHide(el);
  pendingHides.set(el, setTimeout(() => {
    pendingHides.delete(el);
    el.remove();
  }, FADE_MS));
}
