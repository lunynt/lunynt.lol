import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';
import { jsonResponse } from '../../../../lib/http';

export const prerender = false;

const IP_FETCH_LIMIT = 500;

export const GET: APIRoute = async ({ cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const [{ data: total }, { data: ips, error }] = await Promise.all([
    supabaseAdmin.from('counter_total').select('total').eq('id', 1).single(),
    supabaseAdmin.from('counter_ip_breakdown').select('ip, hits, last_seen').limit(IP_FETCH_LIMIT),
  ]);

  if (error) return jsonResponse({ error: 'failed to load counter.' }, 500);

  return jsonResponse({ count: total?.total ?? 0, ips: ips ?? [] }, 200);
};
