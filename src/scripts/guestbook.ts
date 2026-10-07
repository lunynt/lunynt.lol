import { ChevronDown, ChevronUp, createElement } from "lucide";
import { animate } from "motion";
import { askCaptcha } from "./captcha";

interface Entry {
  id: string;
  name: string;
  message: string;
  created_at: string;
  score: number;
  my_vote: number;
  pinned?: boolean;
  reply?: string | null;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const POLL_MS = 15000;

const form = document.querySelector<HTMLFormElement>("[data-guestbook-form]");
const list = document.querySelector<HTMLElement>("[data-guestbook-list]");
const empty = document.querySelector<HTMLElement>("[data-guestbook-empty]");
const statusEl = document.querySelector<HTMLElement>("[data-guestbook-status]");
const counter = document.querySelector<HTMLElement>("[data-guestbook-counter]");
const messageField = form?.querySelector<HTMLTextAreaElement>(
  "textarea[name=message]",
);

const items = new Map<string, HTMLElement>();

const reduced = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const desktop = (): boolean =>
  window.matchMedia("(min-width: 768px)").matches;

const FRIENDLY: Record<number, string> = {
  400: "that didn't go through",
  403: "verification failed, try again",
  404: "that's gone",
  429: "slow down, try again later",
};

const messageFor = (status: number): string =>
  FRIENDLY[status] ?? "something went wrong";

const setStatus = (text: string): void => {
  if (statusEl) {
    statusEl.textContent = text;
  }
};

const updateCounter = (): void => {
  if (!counter || !messageField) {
    return;
  }
  const max = messageField.maxLength > 0 ? messageField.maxLength : 500;
  counter.textContent = `${messageField.value.length}/${max}`;
};

messageField?.addEventListener("input", updateCounter);
updateCounter();

const animateIn = (element: HTMLElement, delay = 0): void => {
  if (reduced()) {
    return;
  }
  animate(
    element,
    { opacity: [0, 1], y: [-10, 0], scale: [0.985, 1] },
    { duration: 0.45, delay, ease: EASE },
  );
};

const animateOut = (element: HTMLElement): void => {
  if (reduced()) {
    element.remove();
    return;
  }
  animate(
    element,
    { opacity: [1, 0], scale: [1, 0.97] },
    { duration: 0.25, ease: EASE },
  ).finished.then(() => element.remove());
};

const bump = (element: HTMLElement | null): void => {
  if (!element || reduced()) {
    return;
  }
  animate(element, { scale: [1, 1.28, 1] }, { duration: 0.32, ease: EASE });
};

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const signature = (entry: Entry): string =>
  [
    entry.name,
    entry.message,
    entry.reply ?? "",
    entry.pinned ? "1" : "0",
  ].join("\u0000");

const paintVote = (item: HTMLElement): void => {
  const score = item.dataset.score ?? "0";
  const vote = Number(item.dataset.vote ?? "0");
  const scoreEl = item.querySelector<HTMLElement>(".gb-score");
  if (scoreEl) {
    scoreEl.textContent = score;
  }
  item.classList.toggle("is-up", vote === 1);
  item.classList.toggle("is-down", vote === -1);
};

const renderEntry = (entry: Entry): HTMLElement => {
  const item = document.createElement("li");
  item.className = "gb-entry";
  item.dataset.id = entry.id;
  item.dataset.score = String(entry.score ?? 0);
  item.dataset.vote = String(entry.my_vote ?? 0);
  item.dataset.sig = signature(entry);

  const vote = document.createElement("div");
  vote.className = "gb-vote";

  const up = document.createElement("button");
  up.type = "button";
  up.className = "gb-vote-btn gb-up";
  up.dataset.vote = "1";
  up.setAttribute("aria-label", "upvote");
  up.append(createElement(ChevronUp, { width: 15, height: 15 }));

  const score = document.createElement("span");
  score.className = "gb-score";
  score.textContent = String(entry.score ?? 0);

  const down = document.createElement("button");
  down.type = "button";
  down.className = "gb-vote-btn gb-down";
  down.dataset.vote = "-1";
  down.setAttribute("aria-label", "downvote");
  down.append(createElement(ChevronDown, { width: 15, height: 15 }));

  vote.append(up, score, down);

  const content = document.createElement("div");
  content.className = "gb-content";

  const head = document.createElement("div");
  head.className = "gb-entry-head";

  const name = document.createElement("span");
  name.className = "gb-entry-name";
  name.textContent = entry.name;
  if (entry.pinned) {
    const pin = document.createElement("span");
    pin.className = "gb-pin";
    pin.textContent = "pinned";
    name.append(" ", pin);
  }

  const date = document.createElement("span");
  date.className = "gb-entry-date";
  date.textContent = formatDate(entry.created_at);

  const message = document.createElement("p");
  message.className = "gb-entry-message";
  message.textContent = entry.message;

  head.append(name, date);
  content.append(head, message);

  if (entry.reply) {
    const reply = document.createElement("div");
    reply.className = "gb-reply";

    const replyHead = document.createElement("div");
    replyHead.className = "gb-reply-head";

    const label = document.createElement("span");
    label.className = "gb-reply-label";
    label.textContent = "lunynt";

    replyHead.append(label);

    const text = document.createElement("p");
    text.className = "gb-reply-text";
    text.textContent = entry.reply;

    reply.append(replyHead, text);
    content.append(reply);
  }

  item.append(content, vote);

  paintVote(item);
  return item;
};

const updateEntry = (element: HTMLElement, entry: Entry): HTMLElement => {
  if (element.dataset.sig !== signature(entry)) {
    const fresh = renderEntry(entry);
    element.replaceWith(fresh);
    return fresh;
  }

  const previous = element.dataset.score;
  element.dataset.score = String(entry.score ?? 0);
  element.dataset.vote = String(entry.my_vote ?? 0);
  paintVote(element);

  if (previous !== element.dataset.score) {
    bump(element.querySelector<HTMLElement>(".gb-score"));
  }

  return element;
};

const syncEntries = (entries: Entry[], mode: "initial" | "live"): void => {
  if (!list) {
    return;
  }

  const animateInitial = mode === "initial" && !desktop();
  const seen = new Set<string>();
  let previous: HTMLElement | null = null;

  entries.forEach((entry, index) => {
    seen.add(entry.id);

    const existing = items.get(entry.id);
    let element = existing ?? null;

    if (!element) {
      element = renderEntry(entry);
      items.set(entry.id, element);
      if (previous) {
        previous.after(element);
      } else {
        list.prepend(element);
      }
      if (mode === "live") {
        animateIn(element);
      } else if (animateInitial) {
        animateIn(element, index * 0.03);
      }
    } else {
      element = updateEntry(element, entry);
      items.set(entry.id, element);
      const inPlace = previous
        ? previous.nextElementSibling === element
        : list.firstElementChild === element;
      if (!inPlace) {
        if (previous) {
          previous.after(element);
        } else {
          list.prepend(element);
        }
      }
    }

    previous = element;
  });

  items.forEach((element, id) => {
    if (!seen.has(id)) {
      items.delete(id);
      animateOut(element);
    }
  });

  if (empty) {
    empty.hidden = entries.length > 0;
  }
};

const load = async (): Promise<void> => {
  if (!list) {
    return;
  }

  try {
    const response = await fetch("/api/guestbook", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { entries?: Entry[] };
    syncEntries(payload.entries ?? [], "initial");
  } catch {
    return;
  }
};

let polling = false;

const refresh = async (): Promise<void> => {
  if (polling || document.visibilityState !== "visible") {
    return;
  }

  polling = true;
  try {
    const response = await fetch("/api/guestbook", {
      headers: { accept: "application/json" },
    });
    if (response.ok) {
      const payload = (await response.json()) as { entries?: Entry[] };
      syncEntries(payload.entries ?? [], "live");
    }
  } catch {
    return;
  } finally {
    polling = false;
  }
};

const startPolling = (): void => {
  window.setInterval(() => void refresh(), POLL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
  });
};

list?.addEventListener("click", async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".gb-vote-btn",
  );
  if (!button) {
    return;
  }

  const item = button.closest<HTMLElement>(".gb-entry");
  if (!item) {
    return;
  }

  const id = item.dataset.id;
  const clicked = Number(button.dataset.vote ?? "0");
  const current = Number(item.dataset.vote ?? "0");
  const next = current === clicked ? 0 : clicked;

  button.disabled = true;

  let token = "";
  try {
    token = await askCaptcha();
  } catch {
    button.disabled = false;
    return;
  }

  try {
    const response = await fetch("/api/guestbook/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, value: next, token }),
    });

    const payload = (await response.json()) as {
      score?: number;
      my_vote?: number;
    };

    if (response.ok && typeof payload.score === "number") {
      item.dataset.score = String(payload.score);
      item.dataset.vote = String(payload.my_vote ?? next);
      paintVote(item);
      bump(item.querySelector<HTMLElement>(".gb-score"));
    } else {
      setStatus(messageFor(response.status));
    }
  } catch {
    return;
  } finally {
    button.disabled = false;
  }
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
  const data = new FormData(form);
  const name = String(data.get("name") ?? "").trim();
  const message = String(data.get("message") ?? "").trim();

  if (!name || !message) {
    setStatus("please fill in both fields");
    return;
  }

  if (submit) {
    submit.disabled = true;
  }
  setStatus("signing...");

  let token = "";
  try {
    token = await askCaptcha();
  } catch {
    setStatus("");
    if (submit) {
      submit.disabled = false;
    }
    return;
  }

  try {
    const response = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, message, token }),
    });

    const payload = (await response.json()) as { entry?: Entry };

    if (!response.ok || !payload.entry || !list) {
      setStatus(messageFor(response.status));
      return;
    }

    const entry = payload.entry;
    const element = renderEntry(entry);
    items.set(entry.id, element);
    list.prepend(element);
    animateIn(element);

    if (empty) {
      empty.hidden = true;
    }
    form.reset();
    updateCounter();
    setStatus("thanks for signing");
  } catch {
    setStatus("something went wrong");
  } finally {
    if (submit) {
      submit.disabled = false;
    }
  }
});

if (list) {
  void load().then(startPolling);
}

export {};
