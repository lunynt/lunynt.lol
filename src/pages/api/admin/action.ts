import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../../lib/db";
import { isAuthenticated } from "../../../lib/admin";
import { isJson, isSameOrigin, isUuid, readJson } from "../../../lib/http";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

const ACTIONS = new Set([
  "approve",
  "deny",
  "pin",
  "unpin",
  "delete",
  "reply",
  "clear-reply",
]);

function clean(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, 500);
}

export const POST: APIRoute = async (context) => {
  if (!isAuthenticated(context.request)) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!isSameOrigin(context.request) || !isJson(context.request)) {
    return json({ error: "forbidden" }, 403);
  }

  const url = databaseUrl();
  if (!url) {
    return json({ error: "no database" }, 503);
  }

  const parsed = await readJson(context.request);
  if (!parsed.ok) {
    return json({ error: "bad request" }, parsed.status);
  }

  const payload = parsed.value as {
    id?: unknown;
    action?: unknown;
    reply?: unknown;
  };

  const id = typeof payload.id === "string" ? payload.id : "";
  const action = typeof payload.action === "string" ? payload.action : "";
  const reply = typeof payload.reply === "string" ? clean(payload.reply) : "";

  if (!isUuid(id) || !ACTIONS.has(action)) {
    return json({ error: "bad request" }, 400);
  }

  try {
    const sql = getSql(url);

    if (action === "approve") {
      await sql`update guestbook set status = 'approved' where id = ${id}`;
    } else if (action === "deny") {
      await sql`update guestbook set status = 'denied', pinned = false where id = ${id}`;
    } else if (action === "pin") {
      await sql`update guestbook set pinned = true where id = ${id}`;
    } else if (action === "unpin") {
      await sql`update guestbook set pinned = false where id = ${id}`;
    } else if (action === "delete") {
      await sql`delete from guestbook where id = ${id}`;
    } else if (action === "reply") {
      await sql`
        update guestbook set reply = ${reply}, replied_at = now() where id = ${id}
      `;
    } else if (action === "clear-reply") {
      await sql`
        update guestbook set reply = null, replied_at = null where id = ${id}
      `;
    }

    return json({ ok: true });
  } catch {
    return json({ error: "failed" }, 500);
  }
};
