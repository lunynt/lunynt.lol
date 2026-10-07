import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../../lib/db";
import { isAuthenticated } from "../../../lib/admin";
import { isJson, isSameOrigin, isUuid, readJson } from "../../../lib/http";
import { fail, json } from "../../../lib/api";

export const prerender = false;

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
  return value.replace(/<[^>]*>/g, " ").trim().slice(0, 500);
}

export const POST: APIRoute = async (context) => {
  if (!isAuthenticated(context.request)) {
    return fail(401);
  }

  if (!isSameOrigin(context.request) || !isJson(context.request)) {
    return fail(403);
  }

  const url = databaseUrl();
  if (!url) {
    return fail(503);
  }

  const parsed = await readJson(context.request);
  if (!parsed.ok) {
    return fail(parsed.status);
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
    return fail(400);
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
      await sql`update guestbook set reply = ${reply}, replied_at = now() where id = ${id}`;
    } else if (action === "clear-reply") {
      await sql`update guestbook set reply = null, replied_at = null where id = ${id}`;
    }

    return json({ ok: true });
  } catch {
    return fail(500);
  }
};
