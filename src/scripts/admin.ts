interface AdminEntry {
  id: string;
  name: string;
  message: string;
  created_at: string;
  score: number;
  status: string;
  pinned: boolean;
  reply: string | null;
}

interface AdminData {
  visits: number;
  counts: { total: number; approved: number; pending: number; denied: number };
  views: { today: number; week: number; total: number };
  topPaths: { path: string; count: number }[];
  daily: { day: string; count: number }[];
  entries: AdminEntry[];
}

const statsEl = document.querySelector<HTMLElement>("[data-admin-stats]");
const barsEl = document.querySelector<HTMLElement>("[data-admin-bars]");
const pathsEl = document.querySelector<HTMLElement>("[data-admin-paths]");
const entriesEl = document.querySelector<HTMLElement>("[data-admin-entries]");

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text != null) {
    node.textContent = text;
  }
  return node;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

let busy = false;

async function send(body: Record<string, unknown>): Promise<void> {
  if (busy) {
    return;
  }
  busy = true;
  try {
    const response = await fetch("/api/admin/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      await load();
    }
  } catch {
    return;
  } finally {
    busy = false;
  }
}

function renderStats(data: AdminData): void {
  if (!statsEl) {
    return;
  }
  statsEl.textContent = "";

  const stats = [
    { label: "visits", value: data.visits },
    { label: "views today", value: data.views.today },
    { label: "views this week", value: data.views.week },
    { label: "views total", value: data.views.total },
    { label: "guestbook", value: data.counts.total },
    { label: "pending", value: data.counts.pending },
  ];

  stats.forEach((stat) => {
    const card = el("div", "admin-card");
    card.append(
      el("p", "admin-stat-value", stat.value.toLocaleString("en-US")),
      el("p", "admin-stat-label", stat.label),
    );
    statsEl.append(card);
  });
}

function renderBars(daily: { day: string; count: number }[]): void {
  if (!barsEl) {
    return;
  }
  barsEl.textContent = "";
  const max = Math.max(1, ...daily.map((entry) => entry.count));

  daily.forEach((entry) => {
    const item = el("div", "admin-bar-item");
    const fill = el("div", "admin-bar-fill");
    fill.style.height = `${Math.max(2, Math.round((entry.count / max) * 72))}px`;
    fill.title = `${entry.count} views`;
    const day = el("span", "admin-bar-day", entry.day.slice(5));
    item.append(fill, day);
    barsEl.append(item);
  });
}

function renderPaths(paths: { path: string; count: number }[]): void {
  if (!pathsEl) {
    return;
  }
  pathsEl.textContent = "";

  if (paths.length === 0) {
    pathsEl.append(el("p", "admin-sub", "no data yet"));
    return;
  }

  paths.forEach((entry) => {
    const row = el("div", "admin-path");
    row.append(
      el("span", "admin-path-name", entry.path),
      el("span", "admin-path-count", entry.count.toLocaleString("en-US")),
    );
    pathsEl.append(row);
  });
}

function badge(text: string): HTMLElement {
  return el("span", "admin-badge", text);
}

function renderEntry(entry: AdminEntry): HTMLElement {
  const card = el("div", `admin-entry${entry.status === "denied" ? " is-denied" : ""}`);

  const head = el("div", "admin-entry-head");
  const left = el("div");
  left.append(el("span", "admin-entry-name", entry.name), document.createTextNode(" "), el("span", "admin-entry-date", formatDate(entry.created_at)));

  const badges = el("div", "admin-badges");
  badges.append(badge(entry.status));
  if (entry.pinned) {
    badges.append(badge("pinned"));
  }
  badges.append(badge(`${entry.score} pts`));
  head.append(left, badges);

  const message = el("p", "admin-entry-message", entry.message);

  card.append(head, message);

  if (entry.reply) {
    const reply = el("div", "admin-entry-reply");
    reply.append(
      el("span", "admin-entry-reply-label", "owner reply"),
      el("p", "admin-entry-reply-text", entry.reply),
    );
    card.append(reply);
  }

  const replyForm = el("div");
  replyForm.hidden = true;
  const input = el("textarea", "admin-reply-input");
  input.rows = 2;
  input.value = entry.reply ?? "";
  const save = el("button", "admin-btn", "save reply");
  save.type = "button";
  save.addEventListener("click", () => {
    save.disabled = true;
    send({ id: entry.id, action: "reply", reply: input.value });
  });
  replyForm.append(input, save);

  const actions = el("div", "admin-actions");
  const button = (label: string, action: string, run?: () => void) => {
    const node = el("button", "admin-btn", label);
    node.type = "button";
    node.addEventListener("click", () => {
      node.disabled = true;
      if (run) {
        run();
      } else {
        send({ id: entry.id, action });
      }
    });
    actions.append(node);
  };

  if (entry.status !== "approved") {
    button("approve", "approve");
  }
  if (entry.status !== "denied") {
    button("deny", "deny");
  }
  button(entry.pinned ? "unpin" : "pin", entry.pinned ? "unpin" : "pin");
  button(entry.reply ? "edit reply" : "reply", "reply", () => {
    replyForm.hidden = !replyForm.hidden;
    if (!replyForm.hidden) {
      input.focus();
    }
  });
  if (entry.reply) {
    button("clear reply", "clear-reply");
  }
  button("delete", "delete");

  card.append(replyForm, actions);
  return card;
}

function renderEntries(entries: AdminEntry[]): void {
  if (!entriesEl) {
    return;
  }
  entriesEl.textContent = "";

  if (entries.length === 0) {
    entriesEl.append(el("p", "admin-sub", "no entries yet"));
    return;
  }

  entries.forEach((entry) => entriesEl.append(renderEntry(entry)));
}

async function load(): Promise<void> {
  try {
    const response = await fetch("/api/admin/data", {
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as AdminData;
    renderStats(data);
    renderBars(data.daily);
    renderPaths(data.topPaths);
    renderEntries(data.entries);
  } catch {
    return;
  }
}

load();

export {};
