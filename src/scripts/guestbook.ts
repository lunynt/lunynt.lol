import { supabase, type GuestbookEntry } from '../lib/supabase';
import { isNameBlacklisted } from '../lib/moderation';

const ENTRY_LIMIT = 50;
const VOTES_STORAGE_KEY = 'guestbook-votes';
const FORM_PARAM_KEYS = ['name', 'website', 'message', 'cf-turnstile-response', 'token'];

const ENTRY_CARD_CLASSES = 'flex flex-col gap-1 p-3 sm:p-4 rounded-xl bg-white/5';
const ENTRY_NAME_CLASSES = 'text-sm font-medium text-white truncate';
const ENTRY_WEBSITE_CLASSES = 'text-white/30 hover:text-white/60 transition-colors shrink-0';
const ENTRY_DATE_CLASSES = 'text-[10px] text-white/30 shrink-0';
const ENTRY_MESSAGE_CLASSES = 'text-sm text-white/50 leading-relaxed whitespace-pre-line break-words';
const ENTRY_META_CLASSES = 'flex items-center gap-2 shrink-0';
const VOTE_WRAP_CLASSES = 'relative flex items-center gap-1';
const VOTE_BUTTON_CLASSES = 'flex items-center justify-center w-4 h-4 text-[11px] leading-none text-white/30 hover:text-white/60 transition-colors disabled:cursor-default disabled:hover:text-white/30';
const VOTE_SCORE_CLASSES = 'text-[10px] text-white/40 tabular-nums min-w-[1.5rem] text-center';
const VOTE_NOTE_CLASSES = 'hidden absolute right-0 top-full mt-1.5 z-10 whitespace-nowrap rounded-lg border border-white/10 backdrop-blur-md bg-white/10 shadow-xl px-2.5 py-1.5 text-[10px] text-white/60';
const VOTE_NOTE_TIMEOUT_MS = 3000;
const ALREADY_VOTED_MESSAGE = 'one vote per ip, you can change it after 24h.';
const CAPTCHA_FAILED_MESSAGE = 'captcha verification failed, try again.';
const STATE_TEXT_CLASSES = 'text-xs text-white/40';

function getStoredVotes(): Record<number, 1 | -1> {
  try {
    const raw = localStorage.getItem(VOTES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    const votes: Record<number, 1 | -1> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(key);
      if (Number.isInteger(id) && (value === 1 || value === -1)) votes[id] = value;
    }
    return votes;
  } catch {
    return {};
  }
}

function storeVote(id: number, vote: 1 | -1) {
  try {
    const votes = getStoredVotes();
    votes[id] = vote;
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(votes));
  } catch {}
}

let voteWidgetId: string | null = null;
let pendingVoteResolve: ((token: string | null) => void) | null = null;

function ensureVoteWidget(): string | null {
  if (voteWidgetId !== null) return voteWidgetId;
  if (!window.turnstile) return null;

  const container = document.getElementById('guestbook-vote-turnstile');
  if (!container) return null;

  voteWidgetId = window.turnstile.render(container, {
    sitekey: container.dataset.sitekey ?? '',
    size: 'invisible',
    callback: (token: string) => {
      pendingVoteResolve?.(token);
      pendingVoteResolve = null;
    },
    'error-callback': () => {
      pendingVoteResolve?.(null);
      pendingVoteResolve = null;
    },
  });

  return voteWidgetId;
}

function getVoteToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const widgetId = ensureVoteWidget();
    if (widgetId === null || !window.turnstile) {
      resolve(null);
      return;
    }

    pendingVoteResolve = resolve;
    window.turnstile.reset(widgetId);
    window.turnstile.execute(widgetId);

    setTimeout(() => {
      if (pendingVoteResolve === resolve) {
        pendingVoteResolve = null;
        resolve(null);
      }
    }, 8000);
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatWebsiteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function createVoteControls(entry: GuestbookEntry): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = VOTE_WRAP_CLASSES;

  const upButton = document.createElement('button');
  upButton.type = 'button';
  upButton.className = VOTE_BUTTON_CLASSES;
  upButton.textContent = '▲';
  upButton.title = 'like, one vote per ip';

  const score = document.createElement('span');
  score.className = VOTE_SCORE_CLASSES;

  const downButton = document.createElement('button');
  downButton.type = 'button';
  downButton.className = VOTE_BUTTON_CLASSES;
  downButton.textContent = '▼';
  downButton.title = 'dislike, one vote per ip';

  const note = document.createElement('span');
  note.className = VOTE_NOTE_CLASSES;

  let count = entry.likes;
  let myVote = getStoredVotes()[entry.id] ?? null;
  let busy = false;
  let noteTimer: ReturnType<typeof setTimeout> | null = null;

  const showNote = (text: string) => {
    note.textContent = text;
    note.classList.remove('hidden');
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(() => note.classList.add('hidden'), VOTE_NOTE_TIMEOUT_MS);
  };

  const render = () => {
    score.textContent = String(count);
    upButton.classList.toggle('text-white/70', myVote === 1);
    downButton.classList.toggle('text-white/70', myVote === -1);
  };
  render();

  const cast = async (vote: 1 | -1) => {
    if (busy) return;
    if (myVote === vote) {
      showNote(ALREADY_VOTED_MESSAGE);
      return;
    }

    busy = true;
    upButton.disabled = true;
    downButton.disabled = true;

    try {
      const token = await getVoteToken();
      if (!token) {
        showNote(CAPTCHA_FAILED_MESSAGE);
        return;
      }

      const res = await fetch(`/api/guestbook/${entry.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, token }),
      });
      const body = await res.json().catch(() => null);

      if (res.ok && body?.success) {
        myVote = vote;
        count = typeof body.likes === 'number' ? body.likes : count;
        storeVote(entry.id, vote);
      } else {
        if (typeof body?.vote === 'number' && (body.vote === 1 || body.vote === -1)) {
          myVote = body.vote;
          storeVote(entry.id, body.vote);
        }
        showNote(body?.error ?? 'something went wrong, try again.');
      }
    } catch {
      showNote('something went wrong, try again.');
    }

    busy = false;
    upButton.disabled = false;
    downButton.disabled = false;
    render();
  };

  upButton.addEventListener('click', () => cast(1));
  downButton.addEventListener('click', () => cast(-1));

  wrap.append(upButton, score, downButton, note);
  return wrap;
}

function createEntryCard(entry: GuestbookEntry): HTMLElement {
  const card = document.createElement('div');
  card.className = ENTRY_CARD_CLASSES;

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-3';

  const nameRow = document.createElement('div');
  nameRow.className = 'flex items-center gap-1.5 min-w-0';

  const name = document.createElement('span');
  name.className = ENTRY_NAME_CLASSES;
  name.textContent = entry.name;
  nameRow.appendChild(name);

  if (entry.website) {
    const link = document.createElement('a');
    link.href = entry.website;
    link.target = '_blank';
    link.rel = 'noopener noreferrer ugc';
    link.className = `${ENTRY_WEBSITE_CLASSES} text-xs truncate`;
    link.title = entry.website;
    link.textContent = `${formatWebsiteLabel(entry.website)} ↗`;
    nameRow.appendChild(link);
  }

  const date = document.createElement('span');
  date.className = ENTRY_DATE_CLASSES;
  date.textContent = formatDate(entry.created_at);

  const meta = document.createElement('div');
  meta.className = ENTRY_META_CLASSES;
  meta.append(date, createVoteControls(entry));

  header.append(nameRow, meta);

  const message = document.createElement('p');
  message.className = ENTRY_MESSAGE_CLASSES;
  message.textContent = entry.message;

  card.append(header, message);
  return card;
}

function renderState(container: HTMLElement, text: string) {
  container.innerHTML = '';
  const state = document.createElement('p');
  state.className = STATE_TEXT_CLASSES;
  state.textContent = text;
  container.appendChild(state);
}

function renderEntries(container: HTMLElement, entries: GuestbookEntry[]) {
  if (entries.length === 0) {
    renderState(container, 'no entries yet, be the first to sign!');
    return;
  }
  container.innerHTML = '';
  for (const entry of entries) container.appendChild(createEntryCard(entry));
}

async function loadEntries(container: HTMLElement) {
  const { data, error } = await supabase
    .from('guestbook')
    .select('id, created_at, name, website, message, likes')
    .order('created_at', { ascending: false })
    .limit(ENTRY_LIMIT);

  if (error || !data) {
    renderState(container, 'unable to load entries.');
    return;
  }

  renderEntries(container, data as GuestbookEntry[]);
}

function subscribeRealtime(container: HTMLElement) {
  let pending: ReturnType<typeof setTimeout> | null = null;

  const refresh = () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(() => loadEntries(container), 200);
  };

  supabase
    .channel('guestbook-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guestbook' }, refresh)
    .subscribe();
}

function cleanFormParams() {
  const url = new URL(window.location.href);
  if (![...url.searchParams.keys()].some((key) => FORM_PARAM_KEYS.includes(key))) return;

  for (const key of FORM_PARAM_KEYS) url.searchParams.delete(key);
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function setError(form: HTMLFormElement, message: string) {
  const el = form.querySelector<HTMLElement>('.guestbook-error');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('hidden', !message);
}

function setSubmitting(form: HTMLFormElement, submitting: boolean) {
  const button = form.querySelector<HTMLButtonElement>('.guestbook-submit');
  if (!button) return;
  button.disabled = submitting;
  button.textContent = submitting ? 'signing...' : 'sign';
}

async function checkStatus(form: HTMLFormElement) {
  try {
    const res = await fetch('/api/guestbook');
    const body = await res.json();
    if (!body.enabled) {
      form.classList.add('hidden');
      setError(form, body.reason ?? 'guestbook is temporarily disabled.');
      const notice = form.parentElement?.querySelector<HTMLElement>('.guestbook-disabled-notice');
      if (notice) {
        notice.textContent = body.reason ?? 'guestbook is temporarily disabled.';
        notice.classList.remove('hidden');
      }
    }
  } catch {}
}

export function initGuestbook() {
  cleanFormParams();

  const form = document.getElementById('guestbook-form') as HTMLFormElement | null;
  const entries = document.getElementById('guestbook-entries');
  if (!form || !entries) return;

  loadEntries(entries);
  checkStatus(form);
  subscribeRealtime(entries);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setError(form, '');

    const data = new FormData(form);
    const name = (data.get('name') as string).trim();
    const website = (data.get('website') as string).trim();
    const message = (data.get('message') as string).trim();
    const token = data.get('cf-turnstile-response') as string | null;

    if (!message) {
      setError(form, 'message is required.');
      return;
    }
    if (name && isNameBlacklisted(name)) {
      setError(form, 'you are not allowed to use that name.');
      return;
    }
    if (!token) {
      setError(form, 'please complete the captcha.');
      return;
    }

    setSubmitting(form, true);

    const res = await fetch('/api/guestbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website, message, token }),
    });

    setSubmitting(form, false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(form, body?.error ?? 'something went wrong, try again later.');
      return;
    }

    form.reset();
    window.turnstile?.reset();
    loadEntries(entries);
  });
}
