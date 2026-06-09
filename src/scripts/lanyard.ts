import { ACTIVITY_VERBS, pickActivities, resolveActivityImage, type LanyardData } from '../lib/lanyard';

const SOCKET_URL = 'wss://api.lanyard.rest/socket';
const RECONNECT_DELAY_MS = 5000;

const CARD_CLASSES = 'currently-card flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-white/5 hover:bg-white/8 transition-colors duration-200';
const IMAGE_CLASSES = 'h-10 w-10 sm:h-12 sm:w-12 rounded-lg object-cover shrink-0';
const LABEL_CLASSES = 'text-xs text-white/40 truncate';
const TITLE_CLASSES = 'text-sm sm:text-base font-medium text-white truncate';
const SUBTITLE_CLASSES = 'text-xs sm:text-sm text-white/50 truncate';

interface CardData {
  href?: string;
  image: string;
  imageAlt: string;
  label: string;
  title: string;
  subtitle: string;
}

function createCard({ href, image, imageAlt, label, title, subtitle }: CardData): HTMLElement {
  const card = document.createElement(href ? 'a' : 'div');
  card.className = CARD_CLASSES;

  if (href) {
    const link = card as HTMLAnchorElement;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }

  if (image) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = imageAlt;
    img.className = IMAGE_CLASSES;
    card.appendChild(img);
  }

  const text = document.createElement('div');
  text.className = 'min-w-0 flex-1';

  const labelEl = document.createElement('p');
  labelEl.className = LABEL_CLASSES;
  labelEl.textContent = label;
  text.appendChild(labelEl);

  if (title) {
    const titleEl = document.createElement('p');
    titleEl.className = TITLE_CLASSES;
    titleEl.textContent = title;
    text.appendChild(titleEl);
  }

  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = SUBTITLE_CLASSES;
    subtitleEl.textContent = subtitle;
    text.appendChild(subtitleEl);
  }

  card.appendChild(text);
  return card;
}

function render(root: HTMLElement, data: LanyardData) {
  root.innerHTML = '';

  const spotify = data.listening_to_spotify ? data.spotify : null;
  const activities = pickActivities(data);

  if (!spotify && activities.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'currently-empty text-xs text-white/40';
    empty.textContent = 'not doing much right now';
    root.appendChild(empty);
    return;
  }

  if (spotify) {
    root.appendChild(createCard({
      href: `https://open.spotify.com/track/${spotify.track_id}`,
      image: spotify.album_art_url,
      imageAlt: spotify.album_art_url,
      label: 'listening to spotify',
      title: spotify.song,
      subtitle: spotify.artist,
    }));
  }

  for (const activity of activities) {
    const image = activity.assets?.large_image
      ? resolveActivityImage(activity.assets.large_image, activity.application_id)
      : '';

    root.appendChild(createCard({
      image,
      imageAlt: activity.assets?.large_text ?? activity.name,
      label: `${ACTIVITY_VERBS[activity.type]} ${activity.name}`,
      title: activity.details ?? '',
      subtitle: activity.state ?? '',
    }));
  }
}

export function initLanyard(userId: string) {
  const node = document.getElementById('currently-content');
  if (!node) return;
  const root: HTMLElement = node;

  let ws: WebSocket;
  let heartbeat: ReturnType<typeof setInterval>;

  function connect() {
    ws = new WebSocket(SOCKET_URL);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.op === 1) {
        heartbeat = setInterval(
          () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ op: 3 })),
          msg.d.heartbeat_interval
        );
        ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: userId } }));
      }
      if (msg.op === 0) render(root, msg.d as LanyardData);
    };

    ws.onerror = () => ws.close();
    ws.onclose = () => {
      clearInterval(heartbeat);
      setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }

  connect();
}
