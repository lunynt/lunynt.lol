import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { supabaseAdmin } from './supabaseAdmin';

const SCRYPT_KEYLEN = 64;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export const SESSION_COOKIE = 'admin_session';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;

  return crypto.timingSafeEqual(candidate, expected);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface AdminSession {
  adminId: string;
  username: string;
}

export async function createSession(adminId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await supabaseAdmin.from('admin_sessions').insert({
    admin_id: adminId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString(),
  });

  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await supabaseAdmin.from('admin_sessions').delete().eq('token_hash', hashToken(token));
}

export async function resolveSession(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const { data: session } = await supabaseAdmin
    .from('admin_sessions')
    .select('admin_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    await supabaseAdmin.from('admin_sessions').delete().eq('token_hash', tokenHash);
    return null;
  }

  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('username')
    .eq('id', session.admin_id)
    .maybeSingle();

  return { adminId: session.admin_id, username: admin?.username ?? '' };
}

export async function requireAdmin(cookies: AstroCookies): Promise<AdminSession | null> {
  const token = cookies.get(SESSION_COOKIE)?.value;
  return resolveSession(token);
}
