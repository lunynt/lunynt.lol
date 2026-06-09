const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const body = new URLSearchParams({
    secret: import.meta.env.TURNSTILE_SECRET_KEY,
    response: token,
    remoteip: ip,
  });

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: 'POST', body });
    if (!res.ok) return false;

    const result = await res.json();
    return result.success === true;
  } catch {
    return false;
  }
}
