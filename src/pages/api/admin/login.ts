import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyPassword, createSession, SESSION_COOKIE } from '../../../lib/auth';
import { isLoginRateLimited, logFailedLoginAttempt } from '../../../lib/loginGuard';
import { jsonResponse } from '../../../lib/http';

export const prerender = false;

interface LoginPayload {
  username?: string;
  password?: string;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress;

  if (await isLoginRateLimited(ip)) {
    return jsonResponse({ error: 'too many login attempts, try again later.' }, 429);
  }

  let payload: LoginPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  const username = (payload.username ?? '').trim();
  const password = payload.password ?? '';

  if (!username || !password) {
    return jsonResponse({ error: 'username and password are required.' }, 400);
  }

  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('id, password_hash')
    .eq('username', username)
    .maybeSingle();

  if (!admin || !verifyPassword(password, admin.password_hash)) {
    await logFailedLoginAttempt(ip);
    return jsonResponse({ error: 'invalid credentials.' }, 401);
  }

  const { token, expiresAt } = await createSession(admin.id);

  cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });

  return jsonResponse({ success: true }, 200);
};
