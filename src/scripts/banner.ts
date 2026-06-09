const PERSPECTIVE = 900;
const ROTATE_X_FACTOR = -7;
const ROTATE_Y_FACTOR = 9;
const PAN_X_FACTOR = -28;
const PAN_Y_FACTOR = -16;
const POS_LIMIT = 0.45;
const ACTIVE_LERP = 0.06;
const IDLE_LERP = 0.025;
const SLEEP_THRESHOLD = 0.001;
const BASE_BRIGHTNESS = '0.5';
const DIM_BRIGHTNESS = '0.3';

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function initBanner() {
  const container = document.getElementById('banner-container') as HTMLElement;
  const grid = document.getElementById('banner-grid') as HTMLElement;

  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  let active = false;
  let asleep = false;

  function setTarget(clientX: number, clientY: number) {
    const rect = container.getBoundingClientRect();
    target.x = clamp((clientX - rect.left) / rect.width - 0.5, -POS_LIMIT, POS_LIMIT);
    target.y = clamp((clientY - rect.top) / rect.height - 0.5, -POS_LIMIT, POS_LIMIT);
  }

  function tick() {
    const lerpFactor = active ? ACTIVE_LERP : IDLE_LERP;
    current.x += (target.x - current.x) * lerpFactor;
    current.y += (target.y - current.y) * lerpFactor;

    if (!active && Math.abs(current.x) < SLEEP_THRESHOLD && Math.abs(current.y) < SLEEP_THRESHOLD) {
      current.x = 0;
      current.y = 0;
      grid.style.transform = '';
      asleep = true;
      return;
    }

    grid.style.transform = [
      `perspective(${PERSPECTIVE}px)`,
      `rotateX(${current.y * ROTATE_X_FACTOR}deg)`,
      `rotateY(${current.x * ROTATE_Y_FACTOR}deg)`,
      `translate3d(${current.x * PAN_X_FACTOR}px, ${current.y * PAN_Y_FACTOR}px, 0)`,
    ].join(' ');

    requestAnimationFrame(tick);
  }

  function wake() {
    if (asleep) {
      asleep = false;
      requestAnimationFrame(tick);
    }
  }

  function setDimmed(dimmed: boolean) {
    document.body.style.setProperty('--bg-brightness', dimmed ? DIM_BRIGHTNESS : BASE_BRIGHTNESS);
  }

  container.addEventListener('mousemove', e => setTarget(e.clientX, e.clientY));
  container.addEventListener('mouseenter', () => { active = true; wake(); setDimmed(true); });
  container.addEventListener('mouseleave', () => { active = false; target.x = 0; target.y = 0; setDimmed(false); });

  container.addEventListener('touchstart', e => {
    active = true;
    wake();
    setDimmed(true);
    setTarget(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });

  container.addEventListener('touchmove', e => {
    e.preventDefault();
    setTarget(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  container.addEventListener('touchend', () => {
    active = false;
    target.x = 0;
    target.y = 0;
    setDimmed(false);
  });

  requestAnimationFrame(tick);
}
