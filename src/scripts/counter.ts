const DIGIT_CLASSES = 'h-14 w-auto';

function renderDigits(root: HTMLElement, count: number) {
  const digitCount = Number(root.dataset.digits) || 6;
  const digits = String(Math.max(0, Math.trunc(count))).padStart(digitCount, '0').split('');

  root.innerHTML = '';
  for (const digit of digits) {
    const img = document.createElement('img');
    img.src = `/counter/${digit}.gif`;
    img.alt = digit;
    img.className = DIGIT_CLASSES;
    root.appendChild(img);
  }
}

export function initCounter() {
  const root = document.getElementById('site-counter-digits');
  if (!root) return;

  fetch('/api/counter')
    .then((res) => res.json())
    .then((body) => {
      if (typeof body?.count === 'number') renderDigits(root, body.count);
    })
    .catch(() => {});
}
