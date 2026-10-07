import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../lib/db";
import { visitor } from "../../config";

export const prerender = false;

const id = visitor.namespace;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function sanitizePath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  let path = value.trim();
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  path = path.split("?")[0].split("#")[0];
  if (path.length > 120) {
    path = path.slice(0, 120);
  }
  return path.length > 1 ? path : "/";
}

export const GET: APIRoute = async (context) => {
  const url = databaseUrl();
  if (!visitor.enabled || !url) {
    return json({ count: null });
  }

  const path = sanitizePath(
    new URL(context.request.url).searchParams.get("path"),
  );

  try {
    const sql = getSql(url);
    const rows = await sql<{ count: string }[]>`
      insert into visits (id, count) values (${id}, 1)
      on conflict (id) do update set count = visits.count + 1
      returning count
    `;

    if (path) {
      await sql`
        insert into page_views (day, path, count) values (current_date, ${path}, 1)
        on conflict (day, path) do update set count = page_views.count + 1
      `;
    }

    const count = rows[0] ? Number(rows[0].count) : 0;
    return json({ count });
  } catch {
    return json({ count: null });
  }
};
