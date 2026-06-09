import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { isSpam, isNameBlacklisted } from '../../lib/moderation';
import { getGuestbookStatus, isIpBlocked, logAttemptAndCheckRaid } from '../../lib/guestbookGuard';
import { isLikelyProxy } from '../../lib/proxyCheck';
import { jsonResponse } from '../../lib/http';

export const prerender = false;

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const NAME_MAX = 60;
const MESSAGE_MAX = 500;
const WEBSITE_PATTERN = /^https?:\/\//;
const ANONYMOUS_NAME = 'anonymous';
const LINK_PATTERN = /https?:\/\/|www\./i;
const REPEATED_CHAR_PATTERN = /(.)\1{6,}/;

async function getSuspicionReasons(ip: string, name: string, website: string, message: string): Promise<string[]> {
  const reasons: string[] = [];

  if (LINK_PATTERN.test(message)) reasons.push('message contains a link');
  if (REPEATED_CHAR_PATTERN.test(message)) reasons.push('repeated characters');

  const letters = message.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 12 && letters === letters.toUpperCase()) reasons.push('all caps message');

  if (website && name && website.toLowerCase().includes(name.toLowerCase())) {
    reasons.push('name matches website');
  }

  if (await isLikelyProxy(ip)) reasons.push('vpn or proxy detected');

  return reasons;
}

interface GuestbookPayload {
  name?: string;
  website?: string;
  message?: string;
  token?: string;
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const body = new URLSearchParams({
    secret: import.meta.env.TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: ip,
  });

  const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
  const result = await res.json();
  return result.success === true;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientAddress;

  const isRaid = await logAttemptAndCheckRaid(ip);
  if (isRaid) {
    return jsonResponse({ error: 'guestbook is temporarily disabled, try again later.' }, 503);
  }

  const status = await getGuestbookStatus();
  if (!status.enabled) {
    return jsonResponse({ error: status.reason ?? 'guestbook is temporarily disabled.' }, 503);
  }

  if (await isIpBlocked(ip)) {
    return jsonResponse({ error: 'you are not allowed to post here.' }, 403);
  }

  let payload: GuestbookPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  const name = (payload.name ?? '').trim();
  const website = (payload.website ?? '').trim();
  const message = (payload.message ?? '').trim();
  const token = (payload.token ?? '').trim();

  if (name.length > NAME_MAX) {
    return jsonResponse({ error: 'name must be at most 60 characters.' }, 400);
  }
  if (name && isNameBlacklisted(name)) {
    return jsonResponse({ error: 'you are not allowed to use that name.' }, 400);
  }
  if (!message || message.length > MESSAGE_MAX) {
    return jsonResponse({ error: 'message must be between 1 and 500 characters.' }, 400);
  }
  if (website && !WEBSITE_PATTERN.test(website)) {
    return jsonResponse({ error: 'website must start with http:// or https://.' }, 400);
  }
  if (!token) {
    return jsonResponse({ error: 'missing captcha token.' }, 400);
  }

  if (isSpam(name) || isSpam(website) || isSpam(message)) {
    return jsonResponse({ error: 'your message was blocked by the content filter.' }, 400);
  }

  const verified = await verifyTurnstile(token, ip);
  if (!verified) {
    return jsonResponse({ error: 'captcha verification failed.' }, 403);
  }

  const reasons = await getSuspicionReasons(ip, name, website, message);

  const { error } = await supabaseAdmin.rpc('insert_guestbook_entry', {
    p_name: name || ANONYMOUS_NAME,
    p_website: website || null,
    p_message: message,
    p_ip: ip,
    p_flagged: reasons.length > 0,
    p_flag_reason: reasons.length > 0 ? reasons.join(', ') : null,
  });

  if (error) {
    return jsonResponse({ error: 'failed to save entry.' }, 500);
  }

  return jsonResponse({ success: true }, 200);
};

export const GET: APIRoute = async () => {
  const status = await getGuestbookStatus();
  return jsonResponse({ enabled: status.enabled, reason: status.reason }, 200);
};
