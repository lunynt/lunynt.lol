import { supabaseAdmin } from './supabaseAdmin';

const RAID_WINDOW_SECONDS = 60;
const RAID_THRESHOLD = 12;

export interface GuestbookStatus {
  enabled: boolean;
  reason: string | null;
}

export async function getGuestbookStatus(): Promise<GuestbookStatus> {
  const { data } = await supabaseAdmin
    .from('site_settings')
    .select('guestbook_enabled, guestbook_disabled_reason')
    .eq('id', 1)
    .single();

  return {
    enabled: data?.guestbook_enabled ?? true,
    reason: data?.guestbook_disabled_reason ?? null,
  };
}

export async function isIpBlocked(ip: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('blocked_ips')
    .select('id')
    .eq('ip', ip)
    .maybeSingle();

  return !!data;
}

export async function logAttemptAndCheckRaid(ip: string): Promise<boolean> {
  await supabaseAdmin.from('guestbook_attempts').insert({ ip });

  const since = new Date(Date.now() - RAID_WINDOW_SECONDS * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from('guestbook_attempts')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);

  if ((count ?? 0) < RAID_THRESHOLD) return false;

  await supabaseAdmin
    .from('site_settings')
    .update({
      guestbook_enabled: false,
      guestbook_disabled_reason: 'raid detected, submissions paused automatically',
      guestbook_disabled_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .eq('guestbook_enabled', true);

  return true;
}
