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
import { containsBlocked } from "../../lib/moderation";
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

function json(
  body: unknown,
  status = 200,
  setCookie?: string | null,
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (setCookie) {
    headers["set-cookie"] = setCookie;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value: string, multiline: boolean): string {
  const pattern = multiline
    ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g
    : /[\u0000-\u001f\u007f]/g;
  return value.replace(pattern, "").trim();
}

function clientIp(context: { clientAddress?: string }): string | null {
  try {
    return context.clientAddress ?? null;
  } catch {
    return null;
  }
}

function identify(context: {
  request: Request;
  clientAddress?: string;
}): { voterId: string; cookie: string | null; ip: string | null } {
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
    return json({ entries }, 200, cookie);
  } catch {
    return json({ entries: [] }, 200, cookie);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isSameOrigin(context.request)) {
    return json({ error: "forbidden" }, 403);
  }

  if (!isJson(context.request)) {
    return json({ error: "unsupported media type" }, 415);
  }

  const url = databaseUrl();
  if (!guestbook.enabled || !url) {
    return json({ error: "guestbook unavailable" }, 503);
  }

  const { voterId, cookie, ip } = identify(context);

  const parsed = await readJson(context.request);
  if (!parsed.ok) {
    return json({ error: "bad request" }, parsed.status, cookie);
  }

  const payload = parsed.value as {
    name?: unknown;
    message?: unknown;
    token?: unknown;
  };

  const name =
    typeof payload.name === "string" ? clean(payload.name, false) : "";
  const message =
    typeof payload.message === "string" ? clean(payload.message, true) : "";
  const token = typeof payload.token === "string" ? payload.token : "";

  if (name.length < 1 || name.length > guestbook.maxName) {
    return json({ error: "please enter a name" }, 400, cookie);
  }

  if (message.length < 1 || message.length > guestbook.maxMessage) {
    return json({ error: "please enter a message" }, 400, cookie);
  }

  if (
    containsBlocked(name, guestbook.blockedWords) ||
    containsBlocked(message, guestbook.blockedWords)
  ) {
    return json({ error: "let's keep it respectful" }, 400, cookie);
  }

  const sql = getSql(url);
  const window = guestbook.windowMinutes * 60;

  const voterAllowed = await allow(
    sql,
    `gb:${voterId}`,
    guestbook.postsPerWindow,
    window,
  );
  if (!voterAllowed) {
    return json(
      { error: "you are posting too fast, try again later" },
      429,
      cookie,
    );
  }

  const ipHash = hashIp(ip);
  if (ipHash) {
    const ipAllowed = await allow(
      sql,
      `gb-ip:${ipHash}`,
      guestbook.postsPerWindow * 3,
      window,
    );
    if (!ipAllowed) {
      return json({ error: "too many posts, try again later" }, 429, cookie);
    }
  }

  const verified = await verifyCaptcha(token, ip);
  if (!verified) {
    return json({ error: "captcha failed, please try again" }, 403, cookie);
  }

  try {
    const rows = await sql<Entry[]>`
      insert into guestbook (name, message)
      values (${name}, ${message})
      returning id, name, message, created_at, score, false as pinned, null::text as reply, 0 as my_vote
    `;
    return json({ entry: rows[0] ?? null }, 200, cookie);
  } catch {
    return json({ error: "could not save your entry" }, 500, cookie);
  }
};
