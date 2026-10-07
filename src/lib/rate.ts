import { createHash } from "node:crypto";
import type { Sql } from "./db";

const runtimeEnv = import.meta.env as Record<string, string | undefined>;

export function hashIp(ip: string | null): string | null {
  if (!ip) {
    return null;
  }

  const salt =
    runtimeEnv.RATE_LIMIT_SALT ??
    process.env.RATE_LIMIT_SALT ??
    "lunynt-rate-limit";

  return createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export async function allow(
  sql: Sql,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const rows = await sql<{ allowed: boolean }[]>`
      select public.check_rate_limit(${key}, ${limit}, ${windowSeconds}) as allowed
    `;
    return rows[0]?.allowed ?? true;
  } catch {
    return true;
  }
}
