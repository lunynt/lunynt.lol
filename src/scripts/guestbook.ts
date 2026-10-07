import { ChevronDown, ChevronUp, createElement } from "lucide";
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

const form = document.querySelector<HTMLFormElement>("[data-guestbook-form]");
const list = document.querySelector<HTMLElement>("[data-guestbook-list]");
const empty = document.querySelector<HTMLElement>("[data-guestbook-empty]");
const statusEl = document.querySelector<HTMLElement>("[data-guestbook-status]");
const counter = document.querySelector<HTMLElement>("[data-guestbook-counter]");
const messageField = form?.querySelector<HTMLTextAreaElement>(
  "textarea[name=message]",
);

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

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const paintVote = (item: HTMLElement): void => {
  const vote = Number(item.dataset.vote ?? "0");
  const scoreEl = item.querySelector<HTMLElement>(".gb-score");
  if (scoreEl) {
    scoreEl.textContent = item.dataset.score ?? "0";
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
    const entries = payload.entries ?? [];
    list.textContent = "";
    entries.forEach((entry) => list.appendChild(renderEntry(entry)));
    if (empty) {
      empty.hidden = entries.length > 0;
    }
  } catch {
    return;
  }
};

list?.addEventListener("click", async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".gb-vote-btn",
  );
  if (!button) {
    return;
  }

  const item = button.closest<HTMLElement>(".gb-entry");
  if (!item || !item.dataset.id) {
    return;
  }

  const clicked = Number(button.dataset.vote ?? "0");
  const current = Number(item.dataset.vote ?? "0");
  const next = current === clicked ? 0 : clicked;

  button.disabled = true;
  try {
    const captcha = await askCaptcha();
    const response = await fetch("/api/guestbook/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.dataset.id, value: next, captcha }),
    });

    const payload = (await response.json()) as {
      score?: number;
      my_vote?: number;
    };

    if (response.ok && typeof payload.score === "number") {
      item.dataset.score = String(payload.score);
      item.dataset.vote = String(payload.my_vote ?? next);
      paintVote(item);
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

  try {
    const captcha = await askCaptcha();
    const response = await fetch("/api/guestbook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, message, captcha }),
    });

    const payload = (await response.json()) as { entry?: Entry };

    if (!response.ok || !payload.entry) {
      setStatus(messageFor(response.status));
      return;
    }

    list?.prepend(renderEntry(payload.entry));
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

load();

export {};
