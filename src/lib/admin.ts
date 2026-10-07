import { createHmac, timingSafeEqual } from "node:crypto";
import type { Sql } from "./db";
import { verifyPassword } from "./password";

const COOKIE = "lunynt_admin";
const MAX_AGE = 60 * 60 * 24 * 7;
const runtimeEnv = import.meta.env as Record<string, string | undefined>;

function env(name: string): string | undefined {
  return runtimeEnv[name] ?? process.env[name];
}

export function adminSecret(): string | undefined {
  return env("ADMIN_SECRET");
}

export async function verifyAdmin(
  sql: Sql,
  username: string,
  password: string,
): Promise<boolean> {
  if (!username || !password) {
    return false;
  }

  const rows = await sql<{ password_hash: string }[]>`
    select password_hash from admins where username = ${username} limit 1
  `;

  const stored = rows[0]?.password_hash;
  return stored ? verifyPassword(password, stored) : false;
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
