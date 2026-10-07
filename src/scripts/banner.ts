const banner = document.querySelector<HTMLElement>("[data-banner]");
const media = banner?.querySelector<HTMLElement>("[data-banner-media]");
const source = media?.querySelector<HTMLImageElement>("img");
const shade = document.querySelector<HTMLElement>("[data-banner-shade]");

if (banner && media && source) {
  const grid = document.createElement("div");
  grid.className = "banner-grid";

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const tile = document.createElement("div");
      tile.className = "banner-tile";
      tile.style.left = `${(col - 1) * 100}%`;
      tile.style.top = `${(row - 1) * 100}%`;
      tile.style.transform = `scale(${col === 1 ? 1 : -1}, ${row === 1 ? 1 : -1})`;

      const clone = source.cloneNode(true) as HTMLImageElement;
      clone.removeAttribute("width");
      clone.removeAttribute("height");
      tile.appendChild(clone);
      grid.appendChild(tile);
    }
  }

  source.style.display = "none";
  media.appendChild(grid);
}

if (
  banner &&
  media &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  const SMOOTH = 7;
  const RISE = 6;
  const ZOOM_REST = 1.05;
  const ZOOM_ACTIVE = 0.85;

  let targetX = 0.5;
  let targetY = 0.5;
  let currentX = 0.5;
  let currentY = 0.5;
  let strength = 0;
  let active = false;
  let frame: number | null = null;
  let last = 0;

  const draw = (): void => {
    const nx = currentX - 0.5;
    const ny = currentY - 0.5;
    media.style.setProperty("--tx", `${nx * -62 * strength}px`);
    media.style.setProperty("--ty", `${ny * -44 * strength}px`);
    media.style.setProperty("--ry", `${nx * -19 * strength}deg`);
    media.style.setProperty("--rx", `${ny * 15 * strength}deg`);
    media.style.setProperty(
      "--zoom",
      `${ZOOM_REST + (ZOOM_ACTIVE - ZOOM_REST) * strength}`,
    );
  };

  const render = (now: number): void => {
    const delta = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;

    const move = 1 - Math.exp(-SMOOTH * delta);
    const rise = 1 - Math.exp(-RISE * delta);

    currentX += (targetX - currentX) * move;
    currentY += (targetY - currentY) * move;
    strength += ((active ? 1 : 0) - strength) * rise;
    draw();

    const settled =
      Math.abs(targetX - currentX) < 0.0005 &&
      Math.abs(targetY - currentY) < 0.0005 &&
      Math.abs((active ? 1 : 0) - strength) < 0.001;

    if (settled) {
      currentX = targetX;
      currentY = targetY;
      strength = active ? 1 : 0;
      draw();
      frame = null;
      last = 0;
    } else {
      frame = window.requestAnimationFrame(render);
    }
  };

  const ensure = (): void => {
    if (frame === null) {
      last = performance.now();
      frame = window.requestAnimationFrame(render);
    }
  };

  const track = (event: PointerEvent): void => {
    const rect = banner.getBoundingClientRect();
    targetX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    targetY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
  };

  const begin = (event: PointerEvent): void => {
    active = true;
    track(event);
    banner.classList.add("is-active");
    shade?.classList.add("is-active");
    ensure();
  };

  const end = (): void => {
    if (!active) {
      return;
    }
    active = false;
    banner.classList.remove("is-active");
    shade?.classList.remove("is-active");
    ensure();
  };

  banner.addEventListener("pointerenter", begin);
  banner.addEventListener("pointerdown", begin);
  banner.addEventListener("pointermove", (event) => {
    if (active) {
      track(event);
    }
  });
  banner.addEventListener("pointerleave", end);
  banner.addEventListener("pointercancel", end);
  window.addEventListener("pointerup", end);
}
