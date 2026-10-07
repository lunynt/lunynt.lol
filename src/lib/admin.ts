import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE = "lunynt_admin";
const MAX_AGE = 60 * 60 * 24 * 7;
const runtimeEnv = import.meta.env as Record<string, string | undefined>;

function env(name: string): string | undefined {
  return runtimeEnv[name] ?? process.env[name];
}

export function adminPassword(): string | undefined {
  return env("ADMIN_PASSWORD");
}

export function adminUsername(): string | undefined {
  return env("ADMIN_USERNAME");
}

export function adminSecret(): string | undefined {
  return env("ADMIN_SECRET") ?? env("ADMIN_PASSWORD");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = adminUsername();
  const expectedPass = adminPassword();
  if (!expectedUser || !expectedPass) {
    return false;
  }
  return safeEqual(username, expectedUser) && safeEqual(password, expectedPass);
}

export function sessionCookie(secure: boolean): string | null {
  const secret = adminSecret();
  if (!secret) {
    return null;
  }

  const payload = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const token = `${payload}.${sign(payload, secret)}`;
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${MAX_AGE}`,
  ];
  if (secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function isAuthenticated(request: Request): boolean {
  const secret = adminSecret();
  if (!secret) {
    return false;
  }

  const header = request.headers.get("cookie");
  if (!header) {
    return false;
  }

  const match = header.match(/(?:^|;\s*)lunynt_admin=([^;]+)/);
  if (!match) {
    return false;
  }

  const [payload, signature] = decodeURIComponent(match[1]).split(".");
  if (!payload || !signature) {
    return false;
  }

  if (!safeEqual(signature, sign(payload, secret))) {
    return false;
  }

  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Math.floor(Date.now() / 1000);
}

export function isSecureRequest(request: Request): boolean {
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}
