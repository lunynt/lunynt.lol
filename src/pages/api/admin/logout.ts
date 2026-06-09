import type { APIRoute } from 'astro';
import { destroySession, SESSION_COOKIE } from '../../../lib/auth';
import { jsonResponse } from '../../../lib/http';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  const token = cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);

  cookies.delete(SESSION_COOKIE, { path: '/' });

  return jsonResponse({ success: true }, 200);
};
