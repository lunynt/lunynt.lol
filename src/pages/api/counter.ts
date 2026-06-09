import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { isIpBlocked } from '../../lib/guestbookGuard';
import { jsonResponse } from '../../lib/http';

export const prerender = false;

const HIT_COOLDOWN_SECONDS = 30 * 60;

async function getTotal(): Promise<number> {
  const { data } = await supabaseAdmin.from('counter_total').select('total').eq('id', 1).single();
  return data?.total ?? 0;
}

export const GET: APIRoute = async ({ clientAddress }) => {
  const ip = clientAddress;

  if (!(await isIpBlocked(ip))) {
    await supabaseAdmin.rpc('record_counter_hit', { p_ip: ip, p_cooldown_seconds: HIT_COOLDOWN_SECONDS });
  }

  return jsonResponse({ count: await getTotal() }, 200);
};
