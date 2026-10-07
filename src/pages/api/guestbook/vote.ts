import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../../lib/db";
import { verifyChallenge } from "../../../lib/challenge";
import { allow, hashIp } from "../../../lib/rate";
import {
  createVoterId,
  isSecure,
  readVoterId,
  voterCookie,
} from "../../../lib/voter";
import { isJson, isSameOrigin, isUuid, readJson } from "../../../lib/http";
import { fail, json } from "../../../lib/api";
import { guestbook } from "../../../config";

export const prerender = false;

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

  let voterId = readVoterId(context.request);
  let cookie: string | null = null;
  if (!voterId) {
    voterId = createVoterId();
    cookie = voterCookie(voterId, isSecure(context.request));
  }
  const headers: Record<string, string> = cookie
    ? { "set-cookie": cookie }
    : {};

  const parsed = await readJson(context.request);
  if (!parsed.ok) {
    return fail(parsed.status, "invalid payload", headers);
  }

  const payload = parsed.value as {
    id?: unknown;
    value?: unknown;
    captcha?: unknown;
  };

  const id = typeof payload.id === "string" ? payload.id : "";
  const captcha = typeof payload.captcha === "string" ? payload.captcha : "";
  const value =
    payload.value === 1 || payload.value === -1 || payload.value === 0
      ? payload.value
      : null;

  if (!isUuid(id) || value === null) {
    return fail(400, "invalid vote", headers);
  }

  let ip: string | null = null;
  try {
    ip = context.clientAddress || null;
  } catch {
    ip = null;
  }

  const identity = hashIp(ip) ?? voterId;
  const sql = getSql(url);

  if (
    !(await allow(sql, `vote:${identity}`, guestbook.votesPerMinute, 60))
  ) {
    return fail(429, "vote rate limit", headers);
  }

  if (!verifyChallenge(captcha)) {
    return fail(403, "challenge failed", headers);
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
      return fail(404, "entry missing", headers);
    }

    return json({ score: outcome.score, my_vote: value }, 200, headers);
  } catch {
    return fail(500, "vote failed", headers);
  }
};
