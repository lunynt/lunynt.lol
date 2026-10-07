const targets = document.querySelectorAll<HTMLElement>("[data-visitor-count]");
const block = document.querySelector<HTMLElement>("[data-visitor-block]");

const setCount = (element: HTMLElement, target: number): void => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = target.toLocaleString("en-US");
    return;
  }

  const duration = 900;
  const start = performance.now();
  const step = (now: number): void => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased).toLocaleString("en-US");
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };

  window.requestAnimationFrame(step);
};

async function loadVisitorCount(): Promise<void> {
  if (targets.length === 0) {
    return;
  }

  try {
    const response = await fetch(
      `/api/visit?path=${encodeURIComponent(window.location.pathname)}`,
      {
        headers: { accept: "application/json" },
      },
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { count?: number };
    if (typeof payload.count === "number") {
      const count = payload.count;
      targets.forEach((target) => setCount(target, count));
      if (block) {
        block.hidden = false;
      }
    }
  } catch {
    return;
  }
}

loadVisitorCount();

export {};
