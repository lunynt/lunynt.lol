import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { requireAdmin } from '../../../../lib/auth';
import { jsonResponse } from '../../../../lib/http';

export const prerender = false;

const IP_PATTERN = /^[a-fA-F0-9.:]+$/;

interface BlockPayload {
  ip?: string;
  reason?: string;
}

export const GET: APIRoute = async ({ cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  const { data, error } = await supabaseAdmin
    .from('blocked_ips')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return jsonResponse({ error: 'failed to load blocked ips.' }, 500);

  return jsonResponse({ blocked: data }, 200);
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  let payload: BlockPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  const ip = (payload.ip ?? '').trim();
  const reason = (payload.reason ?? '').trim();

  if (!ip || !IP_PATTERN.test(ip)) {
    return jsonResponse({ error: 'a valid ip address is required.' }, 400);
  }

  const { error } = await supabaseAdmin
    .from('blocked_ips')
    .insert({ ip, reason: reason || null });

  if (error) return jsonResponse({ error: 'failed to block ip.' }, 500);

  return jsonResponse({ success: true }, 200);
};
