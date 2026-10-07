import { animate } from "motion";
import {
  fetchLanyard,
  normalizePresence,
  type LanyardData,
  type NormalizedActivity,
  type NormalizedEmoji,
  type NormalizedPresence,
} from "../lib/lanyard";

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SOCKET_URL = "wss://api.lanyard.rest/socket";

interface SocketPayload {
  op: number;
  t?: string;
  d?: unknown;
}

interface CardElements {
  header: HTMLElement | null;
  title: HTMLElement | null;
  subtitle: HTMLElement | null;
  body: HTMLElement | null;
  art: HTMLElement | null;
  artA: HTMLElement | null;
  artB: HTMLElement | null;
  progress: HTMLElement | null;
  elapsed: HTMLElement | null;
  duration: HTMLElement | null;
  fill: HTMLElement | null;
  iconSpotify: HTMLElement | null;
  iconActivity: HTMLElement | null;
}

interface Card {
  root: HTMLElement;
  slot: HTMLElement;
  els: CardElements;
  start: number | null;
  end: number | null;
  lastSecond: number;
  artIndex: number;
  currentArt: string | null;
}

const root = document.querySelector<HTMLElement>("[data-presence]");

if (root) {
  const id = root.dataset.discordId ?? "";
  const pickIn = <T extends HTMLElement>(
    scope: ParentNode,
    name: string,
  ): T | null => scope.querySelector<T>(`[data-presence-${name}]`);

  const activitiesEl = pickIn<HTMLElement>(root, "activities");
  const customEl = pickIn<HTMLElement>(root, "custom");
  const customEmojiEl = pickIn<HTMLElement>(root, "custom-emoji");
  const customTextEl = pickIn<HTMLElement>(root, "custom-text");
  const prototype = pickIn<HTMLElement>(root, "prototype");

  const cards = new Map<string, Card>();

  const formatTime = (ms: number): string => {
    const total = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (value: number) => value.toString().padStart(2, "0");
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${minutes}:${pad(seconds)}`;
  };

  const toggle = (element: HTMLElement | null, visible: boolean): void => {
    if (element) {
      element.hidden = !visible;
    }
  };

  const swapText = (
    element: HTMLElement | null,
    value: string,
    visible: boolean,
  ): void => {
    if (!element) {
      return;
    }

    const wasVisible = !element.hidden;
    const same = (element.textContent ?? "") === value && wasVisible === visible;

    if (same) {
      element.textContent = value;
      element.hidden = !visible;
      return;
    }

    if (!visible) {
      if (!wasVisible) {
        return;
      }
      animate(
        element,
        { opacity: [1, 0], y: [0, -6] },
        { duration: 0.2, ease: EASE },
      ).finished.then(() => {
        element.textContent = "";
        element.hidden = true;
        element.style.opacity = "";
        element.style.transform = "";
      });
      return;
    }

    const show = () => {
      element.hidden = false;
      element.textContent = value;
      animate(
        element,
        { opacity: [0, 1], y: [6, 0], filter: ["blur(6px)", "blur(0px)"] },
        { duration: 0.35, ease: EASE },
      );
    };

    if (!wasVisible || (element.textContent ?? "").length === 0) {
      show();
      return;
    }

    animate(
      element,
      { opacity: [1, 0], y: [0, -6], filter: ["blur(0px)", "blur(6px)"] },
      { duration: 0.2, ease: EASE },
    ).finished.then(show);
  };

  const setArt = (card: Card, url: string | null): void => {
    const { art, artA, artB } = card.els;
    if (!art || !artA || !artB || url === card.currentArt) {
      return;
    }

    card.currentArt = url;

    if (!url) {
      art.classList.add("is-empty");
      artA.classList.remove("is-visible");
      artB.classList.remove("is-visible");
      artA.style.backgroundImage = "";
      artB.style.backgroundImage = "";
      card.artIndex = 0;
      return;
    }

    art.classList.remove("is-empty");
    const layers = [artA, artB];
    const incoming = layers[1 - card.artIndex];
    const outgoing = layers[card.artIndex];
    incoming.style.backgroundImage = `url("${url}")`;
    incoming.classList.add("is-visible");
    outgoing.classList.remove("is-visible");
    card.artIndex = 1 - card.artIndex;
  };

  const paintCard = (card: Card): void => {
    const { elapsed, fill } = card.els;
    if (card.start === null || card.end === null || !fill || !elapsed) {
      return;
    }

    const total = card.end - card.start;
    const passed = Math.min(Math.max(Date.now() - card.start, 0), total);
    fill.style.width = `${total > 0 ? (passed / total) * 100 : 0}%`;

    const second = Math.floor(passed / 1000);
    if (second !== card.lastSecond) {
      card.lastSecond = second;
      elapsed.textContent = formatTime(passed);
    }
  };

  let frame: number | null = null;

  const loop = (): void => {
    let active = false;
    cards.forEach((card) => {
      if (card.start !== null && card.end !== null && card.end > card.start) {
        active = true;
        paintCard(card);
      }
    });
    frame = active ? window.requestAnimationFrame(loop) : null;
  };

  const ensureLoop = (): void => {
    if (frame === null) {
      frame = window.requestAnimationFrame(loop);
    }
  };

  const makeCard = (): Card | null => {
    const template = prototype?.firstElementChild as HTMLElement | null;
    if (!template) {
      return null;
    }

    const node = template.cloneNode(true) as HTMLElement;
    const slot = document.createElement("div");
    slot.className = "activity-slot";
    slot.style.height = "0px";
    slot.style.opacity = "0";
    slot.appendChild(node);
    activitiesEl?.appendChild(slot);

    return {
      root: node,
      slot,
      els: {
        header: pickIn(node, "header"),
        title: pickIn(node, "title"),
        subtitle: pickIn(node, "subtitle"),
        body: pickIn(node, "body"),
        art: pickIn(node, "art"),
        artA: pickIn(node, "art-a"),
        artB: pickIn(node, "art-b"),
        progress: pickIn(node, "progress"),
        elapsed: pickIn(node, "elapsed"),
        duration: pickIn(node, "duration"),
        fill: pickIn(node, "fill"),
        iconSpotify: pickIn(node, "icon-spotify"),
        iconActivity: pickIn(node, "icon-activity"),
      },
      start: null,
      end: null,
      lastSecond: -1,
      artIndex: 0,
      currentArt: null,
    };
  };

  const expandSlot = (card: Card): void => {
    const target = card.root.offsetHeight;
    animate(
      card.slot,
      { height: [0, target], opacity: [0, 1] },
      { duration: 0.4, ease: EASE },
    ).finished.then(() => {
      card.slot.style.height = "";
      card.slot.style.opacity = "";
    });
  };

  const updateCard = (card: Card, activity: NormalizedActivity): void => {
    const { els } = card;

    if (els.body) {
      els.body.hidden = !(activity.title || activity.subtitle || activity.art);
    }

    swapText(els.header, activity.header, true);
    swapText(els.title, activity.title ?? "", Boolean(activity.title));
    swapText(els.subtitle, activity.subtitle ?? "", Boolean(activity.subtitle));

    setArt(card, activity.art);
    toggle(els.iconSpotify, activity.source === "spotify");
    toggle(els.iconActivity, activity.source === "activity");

    card.start = activity.start;
    card.end = activity.end;

    const showProgress =
      card.start !== null && card.end !== null && card.end > card.start;
    toggle(els.progress, showProgress);

    if (showProgress && card.start !== null && card.end !== null && els.duration) {
      els.duration.textContent = formatTime(card.end - card.start);
      card.lastSecond = -1;
      ensureLoop();
    } else if (els.fill) {
      els.fill.style.width = "0%";
    }

    paintCard(card);
  };

  const removeCard = (card: Card): void => {
    const target = card.root.offsetHeight;
    animate(
      card.slot,
      { height: [target, 0], opacity: [1, 0] },
      { duration: 0.3, ease: EASE },
    ).finished.then(() => card.slot.remove());
  };

  const renderEmoji = (
    element: HTMLElement | null,
    emoji: NormalizedEmoji | null,
  ): void => {
    if (!element) {
      return;
    }

    element.textContent = "";

    if (!emoji) {
      return;
    }

    if (emoji.id) {
      const image = document.createElement("img");
      image.className = "rpc-emoji";
      image.alt = emoji.name;
      image.loading = "lazy";
      image.src = `https://cdn.discordapp.com/emojis/${emoji.id}.gif`;
      image.addEventListener("error", () => {
        if (image.src.endsWith(".gif")) {
          image.src = `https://cdn.discordapp.com/emojis/${emoji.id}.png`;
        } else {
          image.remove();
          element.textContent = emoji.name;
        }
      });
      element.appendChild(image);
      return;
    }

    element.textContent = emoji.name;
  };

  const showCustom = (isStatus: boolean): void => {
    if (!customEl) {
      return;
    }
    customEl.classList.toggle("is-status", isStatus);
    const wasHidden = customEl.hidden;
    customEl.hidden = false;
    if (wasHidden) {
      animate(
        customEl,
        { opacity: [0, 1], y: [4, 0] },
        { duration: 0.3, ease: EASE },
      );
    }
  };

  const render = (presence: NormalizedPresence): void => {
    if (customEl) {
      const custom = presence.customStatus;
      if (custom) {
        renderEmoji(customEmojiEl, custom.emoji);
        if (customTextEl) {
          customTextEl.textContent = custom.text;
        }
        showCustom(false);
      } else if (presence.activities.length === 0) {
        renderEmoji(customEmojiEl, null);
        if (customTextEl) {
          customTextEl.textContent = presence.status;
        }
        showCustom(true);
      } else {
        customEl.hidden = true;
      }
    }

    const seen = new Set<string>();
    presence.activities.forEach((activity) => {
      seen.add(activity.key);
      const existing = cards.get(activity.key);
      if (existing) {
        updateCard(existing, activity);
        return;
      }

      const created = makeCard();
      if (!created) {
        return;
      }
      cards.set(activity.key, created);
      updateCard(created, activity);
      expandSlot(created);
    });

    cards.forEach((card, key) => {
      if (!seen.has(key)) {
        removeCard(card);
        cards.delete(key);
      }
    });
  };

  const applyData = (data: LanyardData): void => {
    render(normalizePresence(data));
  };

  const refresh = async (): Promise<void> => {
    const data = await fetchLanyard(id);
    if (data) {
      applyData(data);
    }
  };

  let socket: WebSocket | null = null;
  let heartbeat: number | undefined;
  let reconnectDelay = 1000;
  let socketOpen = false;

  const send = (payload: SocketPayload): void => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  };

  const connect = (): void => {
    try {
      socket = new WebSocket(SOCKET_URL);
    } catch {
      return;
    }

    socket.addEventListener("open", () => {
      socketOpen = true;
      reconnectDelay = 1000;
    });

    socket.addEventListener("message", (event) => {
      let payload: SocketPayload;
      try {
        payload = JSON.parse(String(event.data)) as SocketPayload;
      } catch {
        return;
      }

      if (payload.op === 1) {
        const interval =
          (payload.d as { heartbeat_interval?: number } | undefined)
            ?.heartbeat_interval ?? 30000;
        send({ op: 2, d: { subscribe_to_id: id } });
        window.clearInterval(heartbeat);
        heartbeat = window.setInterval(() => send({ op: 3 }), interval);
        return;
      }

      if (payload.op === 0 && payload.d) {
        applyData(payload.d as LanyardData);
      }
    });

    socket.addEventListener("close", () => {
      socketOpen = false;
      socket = null;
      window.clearInterval(heartbeat);
      window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    });

    socket.addEventListener("error", () => {
      socket?.close();
    });
  };

  refresh();
  connect();

  window.setInterval(() => {
    if (!socketOpen) {
      refresh();
    }
  }, 30000);
}
