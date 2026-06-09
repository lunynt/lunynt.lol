import { supabaseAdmin } from './supabaseAdmin';

const WINDOW_SECONDS = 600;
const MAX_ATTEMPTS = 8;

export async function isLoginRateLimited(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('admin_login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('created_at', since);

  return (count ?? 0) >= MAX_ATTEMPTS;
}

export async function logFailedLoginAttempt(ip: string): Promise<void> {
  await supabaseAdmin.from('admin_login_attempts').insert({ ip });
}
