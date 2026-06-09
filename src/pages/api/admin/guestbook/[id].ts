import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';
import { jsonResponse } from '../../../../lib/http';

export const prerender = false;

const NAME_MAX = 60;
const MESSAGE_MAX = 500;
const WEBSITE_PATTERN = /^https?:\/\//;

interface UpdatePayload {
  name?: string;
  website?: string | null;
  message?: string;
  likes?: number;
  like?: boolean;
}

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const PATCH: APIRoute = async ({ request, cookies, params }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const id = parseId(params.id);
  if (id === null) return jsonResponse({ error: 'invalid id.' }, 400);

  let payload: UpdatePayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  const update: Record<string, unknown> = {};

  if (typeof payload.name === 'string') {
    const name = payload.name.trim();
    if (!name || name.length > NAME_MAX) {
      return jsonResponse({ error: 'name must be between 1 and 60 characters.' }, 400);
    }
    update.name = name;
  }

  if (typeof payload.message === 'string') {
    const message = payload.message.trim();
    if (!message || message.length > MESSAGE_MAX) {
      return jsonResponse({ error: 'message must be between 1 and 500 characters.' }, 400);
    }
    update.message = message;
  }

  if (payload.website === null) {
    update.website = null;
  } else if (typeof payload.website === 'string') {
    const website = payload.website.trim();
    if (website && !WEBSITE_PATTERN.test(website)) {
      return jsonResponse({ error: 'website must start with http:// or https://.' }, 400);
    }
    update.website = website || null;
  }

  if (typeof payload.likes === 'number' && Number.isInteger(payload.likes) && payload.likes >= 0) {
    update.likes = payload.likes;
  } else if (payload.like === true) {
    const { data: current } = await supabaseAdmin
      .from('guestbook')
      .select('likes')
      .eq('id', id)
      .maybeSingle();
    update.likes = (current?.likes ?? 0) + 1;
  }

  if (Object.keys(update).length === 0) {
    return jsonResponse({ error: 'nothing to update.' }, 400);
  }

  const { error } = await supabaseAdmin.from('guestbook').update(update).eq('id', id);
  if (error) return jsonResponse({ error: 'failed to update entry.' }, 500);

  return jsonResponse({ success: true }, 200);
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const id = parseId(params.id);
  if (id === null) return jsonResponse({ error: 'invalid id.' }, 400);

  const { error } = await supabaseAdmin.from('guestbook').delete().eq('id', id);
  if (error) return jsonResponse({ error: 'failed to delete entry.' }, 500);

  return jsonResponse({ success: true }, 200);
};
