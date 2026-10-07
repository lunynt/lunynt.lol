import { animate, inView, stagger } from "motion";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const REVEAL_SELECTOR = "h1, h2, p, .block-link, .rpc-app-name";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isDesktop(): boolean {
  return window.matchMedia("(min-width: 768px)").matches;
}

function skipScrollReveal(): boolean {
  return prefersReducedMotion() || isDesktop();
}

function readIntroSeen(): boolean {
  try {
    return sessionStorage.getItem("intro-seen") === "1";
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    sessionStorage.setItem("intro-seen", "1");
  } catch {
    return;
  }
}

function unlockScroll(): void {
  document.documentElement.classList.remove("intro-locked");
}

function tokenize(element: HTMLElement): HTMLElement[] {
  const text = element.textContent ?? "";
  if (text.trim().length === 0) {
    return [];
  }

  element.textContent = "";

  const tokens: HTMLElement[] = [];

  text.split(/(\s+)/).forEach((part) => {
    if (part.length === 0) {
      return;
    }

    if (/^\s+$/.test(part)) {
      element.appendChild(document.createTextNode(part));
      return;
    }

    const mask = document.createElement("span");
    mask.className = "reveal-word";

    const inner = document.createElement("span");
    inner.className = "reveal-word-inner";
    inner.textContent = part;

    mask.appendChild(inner);
    element.appendChild(mask);
    tokens.push(inner);
  });

  return tokens;
}

function collectTokens(scope: HTMLElement): HTMLElement[] {
  const tokens: HTMLElement[] = [];

  scope.querySelectorAll<HTMLElement>(REVEAL_SELECTOR).forEach((target) => {
    if (target.childElementCount > 0) {
      return;
    }
    tokens.push(...tokenize(target));
  });

  return tokens;
}

function revealAll(instant: boolean): void {
  const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
  targets.forEach((element) => {
    if (instant) {
      element.style.opacity = "1";
      element.style.transform = "none";
      return;
    }

    const tokens = collectTokens(element);
    const cards = Array.from(element.querySelectorAll<HTMLElement>(".rpc"));

    inView(
      element,
      () => {
        animate(
          element,
          { opacity: [0, 1], y: [12, 0] },
          { duration: 0.55, ease: EASE },
        );

        if (cards.length > 0) {
          animate(
            cards,
            { opacity: [0, 1], scale: [0.97, 1], y: [10, 0] },
            { duration: 0.6, delay: 0.08, ease: EASE },
          );
        }

        if (tokens.length > 0) {
          animate(
            tokens,
            { y: ["110%", "0%"] },
            { duration: 0.6, delay: stagger(0.02), ease: EASE },
          );
        }
      },
      { amount: 0.15, margin: "0px 0px -10% 0px" },
    );
  });
}

function dismissIntro(intro: HTMLElement): void {
  const lines = Array.from(
    intro.querySelectorAll<HTMLElement>("[data-intro-line]"),
  );

  animate(
    lines,
    { opacity: [1, 0], scale: [1, 0.92], filter: ["blur(0px)", "blur(8px)"] },
    { duration: 0.6, ease: EASE },
  );

  animate(intro, { opacity: [1, 0] }, { duration: 0.6, ease: "easeInOut" });

  window.setTimeout(() => {
    intro.remove();
    unlockScroll();
  }, 620);
}

async function playIntro(): Promise<void> {
  const intro = document.querySelector<HTMLElement>("[data-intro]");
  if (!intro) {
    unlockScroll();
    revealAll(skipScrollReveal());
    return;
  }

  const reduced = prefersReducedMotion();
  if (reduced || readIntroSeen()) {
    intro.remove();
    unlockScroll();
    revealAll(reduced || isDesktop());
    return;
  }

  const content = document.querySelector<HTMLElement>("[data-intro-content]");
  const lines = Array.from(
    intro.querySelectorAll<HTMLElement>("[data-intro-line]"),
  );

  await animate(
    lines,
    {
      opacity: [0, 1],
      y: [18, 0],
      scale: [0.98, 1],
      filter: ["blur(12px)", "blur(0px)"],
    },
    { duration: 0.8, delay: stagger(0.16), ease: EASE },
  ).finished;

  await new Promise((resolve) => window.setTimeout(resolve, 700));

  markIntroSeen();

  if (content) {
    animate(
      content,
      { opacity: [0, 1], scale: [0.96, 1] },
      { duration: 0.9, ease: EASE },
    );
  }

  dismissIntro(intro);
  revealAll(isDesktop());
}

playIntro();
