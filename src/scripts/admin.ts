interface AdminEntry {
  id: number;
  created_at: string;
  name: string;
  website: string | null;
  message: string;
  likes: number;
  ip: string | null;
  flagged: boolean;
  flag_reason: string | null;
}

interface BlockedIp {
  id: string;
  ip: string;
  reason: string | null;
  created_at: string;
}

const INPUT_CLASSES = 'w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors';
const SMALL_BUTTON_CLASSES = 'rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const ENTRY_CARD_CLASSES = 'admin-entry flex flex-col gap-2 p-3 sm:p-4 rounded-xl bg-white/5';
const FLAGGED_CARD_CLASSES = 'border border-amber-400/30 bg-amber-400/5';
const FLAGGED_BADGE_CLASSES = 'inline-flex items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[10px] text-amber-300/80';
const BLOCKED_ROW_CLASSES = 'flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5';

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

async function api(path: string, options: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any }> {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
}

function setMessage(form: HTMLElement, selector: string, text: string) {
  const el = form.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('hidden', !text);
}

export function initAdminLogin() {
  const form = document.getElementById('admin-login-form') as HTMLFormElement | null;
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(form, '.admin-form-error', '');

    const data = new FormData(form);
    const username = (data.get('username') as string).trim();
    const password = data.get('password') as string;

    const { ok, body } = await api('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (!ok) {
      setMessage(form, '.admin-form-error', body?.error ?? 'login failed.');
      return;
    }

    window.location.reload();
  });
}

function renderStatus(root: HTMLElement, toggle: HTMLButtonElement, settings: { guestbook_enabled: boolean; guestbook_disabled_reason: string | null }) {
  const text = root.querySelector<HTMLElement>('.admin-status-text');
  if (text) {
    text.textContent = settings.guestbook_enabled
      ? 'guestbook is enabled.'
      : `guestbook is disabled${settings.guestbook_disabled_reason ? `: ${settings.guestbook_disabled_reason}` : '.'}`;
  }
  toggle.disabled = false;
  toggle.textContent = settings.guestbook_enabled ? 'disable' : 'enable';
  toggle.dataset.enabled = String(settings.guestbook_enabled);
}

async function loadStatus(root: HTMLElement, toggle: HTMLButtonElement) {
  const { ok, body } = await api('/api/admin/settings');
  if (ok && body?.settings) renderStatus(root, toggle, body.settings);
}

function createBlockedRow(entry: BlockedIp, onUnblock: (id: string) => void): HTMLElement {
  const row = document.createElement('div');
  row.className = BLOCKED_ROW_CLASSES;

  const text = document.createElement('div');
  text.className = 'min-w-0';

  const ip = document.createElement('p');
  ip.className = 'text-sm font-medium text-white truncate';
  ip.textContent = entry.ip;

  const meta = document.createElement('p');
  meta.className = 'text-[10px] text-white/30 truncate';
  meta.textContent = `${entry.reason ?? 'no reason given'} • blocked ${formatDate(entry.created_at)}`;

  text.append(ip, meta);

  const unblock = document.createElement('button');
  unblock.className = `${SMALL_BUTTON_CLASSES} shrink-0`;
  unblock.textContent = 'unblock';
  unblock.addEventListener('click', () => onUnblock(entry.id));

  row.append(text, unblock);
  return row;
}

async function loadBlockedIps(container: HTMLElement) {
  const { ok, body } = await api('/api/admin/blocked-ips');
  container.innerHTML = '';

  if (!ok || !body?.blocked) {
    container.innerHTML = '<p class="text-xs text-white/40">failed to load.</p>';
    return;
  }

  const blocked = body.blocked as BlockedIp[];
  if (blocked.length === 0) {
    container.innerHTML = '<p class="text-xs text-white/40">no blocked ips.</p>';
    return;
  }

  for (const entry of blocked) {
    container.appendChild(createBlockedRow(entry, async (id) => {
      const res = await api(`/api/admin/blocked-ips/${id}`, { method: 'DELETE' });
      if (res.ok) loadBlockedIps(container);
    }));
  }
}

function buildEditForm(entry: AdminEntry, onSave: (fields: { name: string; website: string; message: string }) => void, onCancel: () => void): HTMLFormElement {
  const form = document.createElement('form');
  form.className = 'entry-edit-form flex flex-col gap-2 mt-2';

  const nameInput = document.createElement('input');
  nameInput.className = INPUT_CLASSES;
  nameInput.value = entry.name;
  nameInput.maxLength = 60;

  const websiteInput = document.createElement('input');
  websiteInput.className = INPUT_CLASSES;
  websiteInput.value = entry.website ?? '';
  websiteInput.placeholder = 'website';

  const messageInput = document.createElement('textarea');
  messageInput.className = `${INPUT_CLASSES} resize-none`;
  messageInput.value = entry.message;
  messageInput.maxLength = 500;
  messageInput.rows = 3;

  const actions = document.createElement('div');
  actions.className = 'flex gap-2';

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = SMALL_BUTTON_CLASSES;
  save.textContent = 'save';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = SMALL_BUTTON_CLASSES;
  cancel.textContent = 'cancel';
  cancel.addEventListener('click', onCancel);

  actions.append(save, cancel);
  form.append(nameInput, websiteInput, messageInput, actions);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onSave({ name: nameInput.value.trim(), website: websiteInput.value.trim(), message: messageInput.value.trim() });
  });

  return form;
}

function createEntryCard(entry: AdminEntry, callbacks: {
  onUpdate: (id: number, body: Record<string, unknown>) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  onBlockIp: (ip: string) => Promise<void>;
  onRefresh: () => void;
}): HTMLElement {
  const card = document.createElement('div');
  card.className = entry.flagged ? `${ENTRY_CARD_CLASSES} ${FLAGGED_CARD_CLASSES}` : ENTRY_CARD_CLASSES;

  const header = document.createElement('div');
  header.className = 'flex items-start justify-between gap-3';

  const text = document.createElement('div');
  text.className = 'min-w-0';

  const nameRow = document.createElement('div');
  nameRow.className = 'flex items-center gap-1.5 min-w-0';

  const name = document.createElement('p');
  name.className = 'text-sm font-medium text-white truncate';
  name.textContent = entry.name;
  nameRow.appendChild(name);

  if (entry.flagged) {
    const badge = document.createElement('span');
    badge.className = FLAGGED_BADGE_CLASSES;
    badge.textContent = '⚑ suspicious';
    badge.title = entry.flag_reason ?? 'flagged for review';
    nameRow.appendChild(badge);
  }

  if (entry.website) {
    const link = document.createElement('a');
    link.href = entry.website;
    link.target = '_blank';
    link.rel = 'noopener noreferrer ugc';
    link.className = 'text-white/30 hover:text-white/60 transition-colors text-xs truncate shrink-0';
    link.title = entry.website;
    link.textContent = `${formatWebsiteLabel(entry.website)} ↗`;
    nameRow.appendChild(link);
  }

  const meta = document.createElement('p');
  meta.className = 'text-[10px] text-white/30 truncate';
  meta.textContent = `${entry.ip ?? 'unknown ip'} • ${formatDate(entry.created_at)} • ${entry.likes} likes`;
  if (entry.flagged && entry.flag_reason) meta.textContent += ` • flagged: ${entry.flag_reason}`;

  text.append(nameRow, meta);

  const message = document.createElement('p');
  message.className = 'text-sm text-white/50 leading-relaxed whitespace-pre-line break-words';
  message.textContent = entry.message;

  const actions = document.createElement('div');
  actions.className = 'flex flex-wrap gap-2';

  const likeBtn = document.createElement('button');
  likeBtn.className = SMALL_BUTTON_CLASSES;
  likeBtn.textContent = 'like +1';
  likeBtn.addEventListener('click', async () => {
    if (await callbacks.onUpdate(entry.id, { like: true })) callbacks.onRefresh();
  });

  const likesInput = document.createElement('input');
  likesInput.type = 'number';
  likesInput.min = '0';
  likesInput.value = String(entry.likes);
  likesInput.className = `${INPUT_CLASSES} w-20`;

  const setLikesBtn = document.createElement('button');
  setLikesBtn.className = SMALL_BUTTON_CLASSES;
  setLikesBtn.textContent = 'set likes';
  setLikesBtn.addEventListener('click', async () => {
    const value = Number(likesInput.value);
    if (!Number.isInteger(value) || value < 0) return;
    if (await callbacks.onUpdate(entry.id, { likes: value })) callbacks.onRefresh();
  });

  const editBtn = document.createElement('button');
  editBtn.className = SMALL_BUTTON_CLASSES;
  editBtn.textContent = 'edit';

  const deleteBtn = document.createElement('button');
  deleteBtn.className = SMALL_BUTTON_CLASSES;
  deleteBtn.textContent = 'delete';
  deleteBtn.addEventListener('click', async () => {
    if (!window.confirm('delete this entry?')) return;
    if (await callbacks.onDelete(entry.id)) callbacks.onRefresh();
  });

  const blockBtn = document.createElement('button');
  blockBtn.className = SMALL_BUTTON_CLASSES;
  blockBtn.textContent = 'block ip';
  blockBtn.disabled = !entry.ip;
  blockBtn.addEventListener('click', async () => {
    if (!entry.ip) return;
    if (!window.confirm(`block ip ${entry.ip}?`)) return;
    await callbacks.onBlockIp(entry.ip);
  });

  actions.append(likeBtn, likesInput, setLikesBtn, editBtn, deleteBtn, blockBtn);

  let editForm: HTMLFormElement | null = null;
  editBtn.addEventListener('click', () => {
    if (editForm) {
      editForm.remove();
      editForm = null;
      return;
    }
    editForm = buildEditForm(entry, async (fields) => {
      if (await callbacks.onUpdate(entry.id, fields)) callbacks.onRefresh();
    }, () => {
      editForm?.remove();
      editForm = null;
    });
    card.appendChild(editForm);
  });

  header.appendChild(text);
  card.append(header, message, actions);
  return card;
}

async function loadEntries(container: HTMLElement) {
  const { ok, body } = await api('/api/admin/guestbook');
  container.innerHTML = '';

  if (!ok || !body?.entries) {
    container.innerHTML = '<p class="text-xs text-white/40">failed to load.</p>';
    return;
  }

  const entries = body.entries as AdminEntry[];
  if (entries.length === 0) {
    container.innerHTML = '<p class="text-xs text-white/40">no entries.</p>';
    return;
  }

  const callbacks = {
    onUpdate: async (id: number, fields: Record<string, unknown>) => {
      const res = await api(`/api/admin/guestbook/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
      return res.ok;
    },
    onDelete: async (id: number) => {
      const res = await api(`/api/admin/guestbook/${id}`, { method: 'DELETE' });
      return res.ok;
    },
    onBlockIp: async (ip: string) => {
      await api('/api/admin/blocked-ips', { method: 'POST', body: JSON.stringify({ ip, reason: 'blocked from guestbook entry' }) });
    },
    onRefresh: () => loadEntries(container),
  };

  for (const entry of entries) {
    container.appendChild(createEntryCard(entry, callbacks));
  }
}

export function initAdminDashboard() {
  const dashboard = document.getElementById('admin-dashboard');
  if (!dashboard) return;

  const logout = document.getElementById('admin-logout');
  logout?.addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    window.location.reload();
  });

  const statusRoot = document.getElementById('admin-status');
  const statusToggle = document.getElementById('admin-status-toggle') as HTMLButtonElement | null;
  if (statusRoot && statusToggle) {
    loadStatus(statusRoot, statusToggle);
    statusToggle.addEventListener('click', async () => {
      const enabled = statusToggle.dataset.enabled === 'true';
      statusToggle.disabled = true;
      const { ok } = await api('/api/admin/settings', { method: 'PATCH', body: JSON.stringify({ enabled: !enabled }) });
      if (ok) loadStatus(statusRoot, statusToggle);
      else statusToggle.disabled = false;
    });
  }

  const passwordForm = document.getElementById('admin-password-form') as HTMLFormElement | null;
  passwordForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setMessage(passwordForm, '.admin-form-error', '');
    setMessage(passwordForm, '.admin-form-success', '');

    const data = new FormData(passwordForm);
    const currentPassword = data.get('currentPassword') as string;
    const newPassword = data.get('newPassword') as string;

    const { ok, body } = await api('/api/admin/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!ok) {
      setMessage(passwordForm, '.admin-form-error', body?.error ?? 'failed to update password.');
      return;
    }

    passwordForm.reset();
    setMessage(passwordForm, '.admin-form-success', 'password updated.');
  });

  const blockForm = document.getElementById('admin-block-form') as HTMLFormElement | null;
  const blockedList = document.getElementById('admin-blocked-list');
  if (blockedList) loadBlockedIps(blockedList);

  blockForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(blockForm);
    const ip = (data.get('ip') as string).trim();
    const reason = (data.get('reason') as string).trim();
    if (!ip) return;

    const { ok } = await api('/api/admin/blocked-ips', {
      method: 'POST',
      body: JSON.stringify({ ip, reason }),
    });

    if (ok) {
      blockForm.reset();
      if (blockedList) loadBlockedIps(blockedList);
    }
  });

  const entriesContainer = document.getElementById('admin-entries');
  if (entriesContainer) loadEntries(entriesContainer);
}
