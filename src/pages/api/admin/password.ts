import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { requireAdmin, verifyPassword, hashPassword } from '../../../lib/auth';
import { jsonResponse } from '../../../lib/http';

export const prerender = false;

const PASSWORD_MIN = 8;

interface PasswordPayload {
  currentPassword?: string;
  newPassword?: string;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const session = await requireAdmin(cookies);
  if (!session) return jsonResponse({ error: 'unauthorized.' }, 401);

  let payload: PasswordPayload;
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid request body.' }, 400);
  }

  const currentPassword = payload.currentPassword ?? '';
  const newPassword = payload.newPassword ?? '';

  if (!currentPassword || !newPassword) {
    return jsonResponse({ error: 'current and new password are required.' }, 400);
  }
  if (newPassword.length < PASSWORD_MIN) {
    return jsonResponse({ error: `new password must be at least ${PASSWORD_MIN} characters.` }, 400);
  }

  const { data: admin } = await supabaseAdmin
    .from('admin_users')
    .select('id, password_hash')
    .eq('id', session.adminId)
    .maybeSingle();

  if (!admin || !verifyPassword(currentPassword, admin.password_hash)) {
    return jsonResponse({ error: 'current password is incorrect.' }, 403);
  }

  const { error } = await supabaseAdmin
    .from('admin_users')
    .update({ password_hash: hashPassword(newPassword) })
    .eq('id', admin.id);

  if (error) return jsonResponse({ error: 'failed to update password.' }, 500);

  return jsonResponse({ success: true }, 200);
};
