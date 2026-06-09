import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';
import { jsonResponse } from '../../../../lib/http';

export const prerender = false;

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const ip = params.ip;
  if (!ip) return jsonResponse({ error: 'invalid ip.' }, 400);

  const { error } = await supabaseAdmin.from('counter_hits').delete().eq('ip', ip);
  if (error) return jsonResponse({ error: 'failed to remove counter entries.' }, 500);

  return jsonResponse({ success: true }, 200);
};
