import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../../lib/db";
import { verifyCaptcha } from "../../../lib/captcha";
import { allow, hashIp } from "../../../lib/rate";
import {
  createVoterId,
  isSecure,
  readVoterId,
  voterCookie,
} from "../../../lib/voter";
import { isJson, isSameOrigin, isUuid, readJson } from "../../../lib/http";
import { guestbook } from "../../../config";

export const prerender = false;

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

function clientIp(context: { clientAddress?: string }): string | null {
  try {
    return context.clientAddress ?? null;
  } catch {
    return null;
  }
}

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

  let voterId = readVoterId(context.request);
  let cookie: string | null = null;
  if (!voterId) {
    voterId = createVoterId();
    cookie = voterCookie(voterId, isSecure(context.request));
  }

  const parsed = await readJson(context.request);
  if (!parsed.ok) {
    return json({ error: "bad request" }, parsed.status, cookie);
  }

  const payload = parsed.value as {
    id?: unknown;
    value?: unknown;
    token?: unknown;
  };

  const id = typeof payload.id === "string" ? payload.id : "";
  const token = typeof payload.token === "string" ? payload.token : "";
  const value =
    payload.value === 1 || payload.value === -1 || payload.value === 0
      ? payload.value
      : null;

  if (!isUuid(id) || value === null) {
    return json({ error: "bad request" }, 400, cookie);
  }

  const ip = clientIp(context);
  const ipHash = hashIp(ip);
  const identity = ipHash ?? voterId;

  const sql = getSql(url);
  const allowed = await allow(
    sql,
    `vote:${identity}`,
    guestbook.votesPerMinute,
    60,
  );
  if (!allowed) {
    return json({ error: "you are voting too fast" }, 429, cookie);
  }

  const verified = await verifyCaptcha(token, ip);
  if (!verified) {
    return json({ error: "captcha failed, please try again" }, 403, cookie);
  }

  try {
    const outcome = await sql.begin(async (tx) => {
      const found = await tx<{ id: string }[]>`
        select id from guestbook where id = ${id} for update
      `;
      if (!found[0]) {
        return { found: false as const };
      }

      if (value === 0) {
        await tx`
          delete from guestbook_votes
          where entry_id = ${id} and voter_id = ${identity}
        `;
      } else {
        await tx`
          insert into guestbook_votes (entry_id, voter_id, value)
          values (${id}, ${identity}, ${value})
          on conflict (entry_id, voter_id)
          do update set value = excluded.value, created_at = now()
        `;
      }

      const rows = await tx<{ score: number }[]>`
        update guestbook
        set score = (
          select coalesce(sum(v.value), 0)
          from guestbook_votes v
          where v.entry_id = ${id}
        )
        where id = ${id}
        returning score
      `;

      return { found: true as const, score: rows[0]?.score ?? 0 };
    });

    if (!outcome.found) {
      return json({ error: "entry not found" }, 404, cookie);
    }

    return json({ score: outcome.score, my_vote: value }, 200, cookie);
  } catch {
    return json({ error: "could not save your vote" }, 500, cookie);
  }
};
