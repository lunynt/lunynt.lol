import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../lib/db";
import { verifyCaptcha } from "../../lib/captcha";
import { allow, hashIp } from "../../lib/rate";
import {
  createVoterId,
  isSecure,
  readVoterId,
  voterCookie,
} from "../../lib/voter";
import { isJson, isSameOrigin, readJson } from "../../lib/http";
import { containsBlocked, sanitize } from "../../lib/moderation";
import { fail, json } from "../../lib/api";
import { guestbook } from "../../config";

export const prerender = false;

interface Entry {
  id: string;
  name: string;
  message: string;
  created_at: string;
  score: number;
  my_vote: number;
  pinned: boolean;
  reply: string | null;
}

function clientIp(context: { clientAddress?: string }): string | null {
  try {
    return context.clientAddress ?? null;
  } catch {
    return null;
  }
}

function identify(context: { request: Request; clientAddress?: string }) {
  let voterId = readVoterId(context.request);
  let cookie: string | null = null;
  if (!voterId) {
    voterId = createVoterId();
    cookie = voterCookie(voterId, isSecure(context.request));
  }
  return { voterId, cookie, ip: clientIp(context) };
}

export const GET: APIRoute = async (context) => {
  const url = databaseUrl();
  if (!guestbook.enabled || !url) {
    return json({ entries: [] });
  }

  const { voterId, cookie, ip } = identify(context);
  const identity = hashIp(ip) ?? voterId;
  const headers: Record<string, string> = cookie
    ? { "set-cookie": cookie }
    : {};

  try {
    const sql = getSql(url);
    const entries = await sql<Entry[]>`
      select
        g.id, g.name, g.message, g.created_at, g.score, g.pinned, g.reply,
        coalesce(v.value, 0) as my_vote
      from guestbook g
      left join guestbook_votes v
        on v.entry_id = g.id and v.voter_id = ${identity}
      where g.status = 'approved'
      order by g.pinned desc, g.created_at desc
      limit ${guestbook.pageSize}
    `;
    return json({ entries }, 200, headers);
  } catch {
    return fail(500, "guestbook query failed", headers);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) {
    return fail(403, "cross-origin request");
  }

  if (!isJson(context.request)) {
    return fail(415, "expected json body");
  }

  const url = databaseUrl();
  if (!guestbook.enabled || !url) {
    return fail(503, "guestbook disabled");
  }

  const { voterId, cookie, ip } = identify(context);
  const headers: Record<string, string> = cookie
    ? { "set-cookie": cookie }
    : {};

  const parsed = await readJson(context.request);
  if (!parsed.ok) {
    return fail(parsed.status, "invalid payload", headers);
  }

  const payload = parsed.value as {
    name?: unknown;
    message?: unknown;
    token?: unknown;
  };

  const name =
    typeof payload.name === "string" ? sanitize(payload.name, false) : "";
  const message =
    typeof payload.message === "string" ? sanitize(payload.message, true) : "";
  const token = typeof payload.token === "string" ? payload.token : "";

  if (
    name.length < 1 ||
    name.length > guestbook.maxName ||
    message.length < 1 ||
    message.length > guestbook.maxMessage
  ) {
    return fail(400, "invalid length", headers);
  }

  if (
    containsBlocked(name, guestbook.blockedWords) ||
    containsBlocked(message, guestbook.blockedWords)
  ) {
    return fail(400, "blocked content", headers);
  }

  const sql = getSql(url);
  const window = guestbook.windowMinutes * 60;

  if (
    !(await allow(sql, `gb:${voterId}`, guestbook.postsPerWindow, window))
  ) {
    return fail(429, "visitor rate limit", headers);
  }

  const ipHash = hashIp(ip);
  if (
    ipHash &&
    !(await allow(
      sql,
      `gb-ip:${ipHash}`,
      guestbook.postsPerWindow * 3,
      window,
    ))
  ) {
    return fail(429, "ip rate limit", headers);
  }

  if (!(await verifyCaptcha(token, ip))) {
    return fail(403, "captcha failed", headers);
  }

  try {
    const rows = await sql<Entry[]>`
      insert into guestbook (name, message)
      values (${name}, ${message})
      returning id, name, message, created_at, score, false as pinned, null::text as reply, 0 as my_vote
    `;
    return json({ entry: rows[0] ?? null }, 200, headers);
  } catch {
    return fail(500, "insert failed", headers);
  }
};
