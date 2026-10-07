const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

const flash = (element: HTMLElement): void => {
  element.classList.add("is-target");
  window.setTimeout(() => element.classList.remove("is-target"), 1400);
};

const goToHash = (hash: string): void => {
  if (hash.length < 2) {
    return;
  }

  const target = document.querySelector<HTMLElement>(hash);
  if (!target) {
    return;
  }

  target.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
  flash(target);
};

const introLocked = (): boolean =>
  document.documentElement.classList.contains("intro-locked");

const runPendingHash = (): void => {
  const holder = window as unknown as { __pendingHash?: string };
  const pending = holder.__pendingHash;
  if (!pending) {
    return;
  }

  holder.__pendingHash = undefined;
  goToHash(pending);
  window.history.replaceState(null, "", pending);
};

if (introLocked()) {
  const observer = new MutationObserver(() => {
    if (!introLocked()) {
      observer.disconnect();
      window.setTimeout(runPendingHash, 60);
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.setTimeout(() => {
    observer.disconnect();
    runPendingHash();
  }, 4000);
} else {
  runPendingHash();
}

window.addEventListener("hashchange", () => {
  goToHash(window.location.hash);
});

const hashLinks = document.querySelectorAll<HTMLAnchorElement>("[data-hash]");

hashLinks.forEach((link) => {
  const title = link.parentElement?.querySelector<HTMLElement>(".block-link");
  if (!title) {
    return;
  }

  const original = title.textContent ?? "";
  let sequence = 0;
  let inner = 0;
  let revert = 0;

  const swapTo = (text: string): void => {
    const id = ++sequence;
    window.clearTimeout(inner);
    window.clearTimeout(revert);

    title.classList.add("is-swapping");
    inner = window.setTimeout(() => {
      if (id !== sequence) {
        return;
      }
      title.textContent = text;
      title.classList.remove("is-swapping");
    }, 180);
  };

  link.addEventListener("click", async () => {
    const target = link.dataset.target ?? link.getAttribute("href") ?? "";
    const url = `${window.location.origin}${window.location.pathname}${target}`;

    try {
      await navigator.clipboard.writeText(url);
      swapTo("copied link");
    } catch {
      swapTo("copy failed");
    }

    revert = window.setTimeout(() => swapTo(original), 1600);
  });
});

export {};
