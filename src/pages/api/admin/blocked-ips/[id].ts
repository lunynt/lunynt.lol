import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';
import { jsonResponse } from '../../../../lib/http';

export const prerender = false;

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const id = params.id;
  if (!id) return jsonResponse({ error: 'invalid id.' }, 400);

  const { error } = await supabaseAdmin.from('blocked_ips').delete().eq('id', id);
  if (error) return jsonResponse({ error: 'failed to unblock ip.' }, 500);

  return jsonResponse({ success: true }, 200);
};
