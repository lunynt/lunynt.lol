import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../lib/auth';
import { jsonResponse } from '../../../lib/http';

export const prerender = false;

interface SettingsPayload {
  enabled?: boolean;
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const { data, error } = await supabaseAdmin
    .from('site_settings')
    .select('guestbook_enabled, guestbook_disabled_reason, guestbook_disabled_at')
    .eq('id', 1)
    .single();

  if (error) return jsonResponse({ error: 'failed to load settings.' }, 500);

  return jsonResponse({ settings: data }, 200);
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  let payload: SettingsPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  if (typeof payload.enabled !== 'boolean') {
    return jsonResponse({ error: 'enabled must be a boolean.' }, 400);
  }

  const update = payload.enabled
    ? { guestbook_enabled: true, guestbook_disabled_reason: null, guestbook_disabled_at: null }
    : { guestbook_enabled: false, guestbook_disabled_reason: 'manually disabled by admin', guestbook_disabled_at: new Date().toISOString() };

  const { error } = await supabaseAdmin.from('site_settings').update(update).eq('id', 1);
  if (error) return jsonResponse({ error: 'failed to update settings.' }, 500);

  return jsonResponse({ success: true }, 200);
};
