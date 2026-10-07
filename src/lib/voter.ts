const COOKIE = "lunynt_vid";

export function readVoterId(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }

  const match = header.match(/(?:^|;\s*)lunynt_vid=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function createVoterId(): string {
  return crypto.randomUUID();
}

export function voterCookie(id: string, secure: boolean): string {
  const parts = [
    `${COOKIE}=${id}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=63072000",
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function isSecure(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
