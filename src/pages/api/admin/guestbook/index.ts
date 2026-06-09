import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';
import { jsonResponse } from '../../../../lib/http';

export const prerender = false;

const ENTRY_LIMIT = 200;

export const GET: APIRoute = async ({ cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const { data, error } = await supabaseAdmin
    .from('guestbook')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(ENTRY_LIMIT);

  if (error) return jsonResponse({ error: 'failed to load entries.' }, 500);

  return jsonResponse({ entries: data }, 200);
};
