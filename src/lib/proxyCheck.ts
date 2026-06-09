const PROXY_CHECK_URL = 'https://check.getipintel.net/check.php';
const PROXY_THRESHOLD = 0.9;
const PRIVATE_RANGES = [/^127\./, /^10\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^::1$/, /^fc00:/, /^fe80:/];

export async function isLikelyProxy(ip: string): Promise<boolean> {
  if (!ip || PRIVATE_RANGES.some((pattern) => pattern.test(ip))) return false;

  const params = new URLSearchParams({
    ip,
    contact: import.meta.env.PROXY_CHECK_CONTACT,
    format: 'json',
    flags: 'b',
  });

  try {
    const res = await fetch(`${PROXY_CHECK_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return false;

    const data = await res.json();
    const score = Number.parseFloat(data?.result);
    return Number.isFinite(score) && score >= PROXY_THRESHOLD;
  } catch {
    return false;
  }
}
