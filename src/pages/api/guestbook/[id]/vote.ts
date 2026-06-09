import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { isIpBlocked } from '../../../../lib/guestbookGuard';
import { isLikelyProxy } from '../../../../lib/proxyCheck';
import { jsonResponse } from '../../../../lib/http';
import { verifyTurnstile } from '../../../../lib/turnstile';

export const prerender = false;

const DUPLICATE_KEY = '23505';
const REVOTE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

interface VotePayload {
  vote?: number;
  token?: string;
}

export const POST: APIRoute = async ({ params, request, clientAddress }) => {
  const ip = clientAddress;
  const entryId = Number(params.id);

  if (!Number.isInteger(entryId) || entryId <= 0) {
    return jsonResponse({ error: 'invalid entry.' }, 400);
  }

  let payload: VotePayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  const vote = payload.vote;
  const token = (payload.token ?? '').trim();

  if (vote !== 1 && vote !== -1) {
    return jsonResponse({ error: 'invalid vote.' }, 400);
  }
  if (!token) {
    return jsonResponse({ error: 'missing captcha token.' }, 400);
  }

  if (await isIpBlocked(ip)) {
    return jsonResponse({ error: 'you are not allowed to vote on entries.' }, 403);
  }

  const verified = await verifyTurnstile(token, ip);
  if (!verified) {
    return jsonResponse({ error: 'captcha verification failed.' }, 403);
  }

  const { data: existing } = await supabaseAdmin
    .from('guestbook_likes')
    .select('id, vote, updated_at')
    .eq('entry_id', entryId)
    .eq('ip', ip)
    .maybeSingle();

  if (existing) {
    if (existing.vote === vote) {
      return jsonResponse({ error: 'you already voted this way on this entry.', vote: existing.vote }, 409);
    }

    const elapsed = Date.now() - new Date(existing.updated_at).getTime();
    if (elapsed < REVOTE_COOLDOWN_MS) {
      const hoursLeft = Math.ceil((REVOTE_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
      return jsonResponse(
        { error: `you can change your vote in about ${hoursLeft}h.`, vote: existing.vote },
        429
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('guestbook_likes')
      .update({ vote, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (updateError) {
      return jsonResponse({ error: 'failed to update vote.' }, 500);
    }

    const { data: likes, error: applyError } = await supabaseAdmin.rpc('apply_guestbook_vote', {
      p_entry_id: entryId,
      p_delta: vote - existing.vote,
    });

    if (applyError) {
      return jsonResponse({ error: 'failed to update vote.' }, 500);
    }

    return jsonResponse({ success: true, vote, likes }, 200);
  }

  if (await isLikelyProxy(ip)) {
    return jsonResponse({ error: 'votes from vpns or proxies are not allowed.' }, 403);
  }

  const { error: insertError } = await supabaseAdmin
    .from('guestbook_likes')
    .insert({ entry_id: entryId, ip, vote });

  if (insertError) {
    if (insertError.code === DUPLICATE_KEY) {
      return jsonResponse({ error: 'you already voted on this entry.' }, 409);
    }
    return jsonResponse({ error: 'failed to vote on entry.' }, 500);
  }

  const { data: likes, error: applyError } = await supabaseAdmin.rpc('apply_guestbook_vote', {
    p_entry_id: entryId,
    p_delta: vote,
  });

  if (applyError) {
    return jsonResponse({ error: 'failed to vote on entry.' }, 500);
  }

  return jsonResponse({ success: true, vote, likes }, 200);
};
