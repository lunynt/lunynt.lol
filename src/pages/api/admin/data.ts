import type { APIRoute } from "astro";
import { databaseUrl, getSql } from "../../../lib/db";
import { isAuthenticated } from "../../../lib/admin";
import { fail, json } from "../../../lib/api";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!isAuthenticated(context.request)) {
    return fail(401);
  }

  const url = databaseUrl();
  if (!url) {
    return fail(503);
  }

  try {
    const sql = getSql(url);

    const [visits] = await sql<{ count: string }[]>`
      select count from visits where id = 'lunynt.lol'
    `;

    const [counts] = await sql<
      { total: number; approved: number; pending: number; denied: number }[]
    >`
      select
        count(*)::int as total,
        count(*) filter (where status = 'approved')::int as approved,
        count(*) filter (where status = 'pending')::int as pending,
        count(*) filter (where status = 'denied')::int as denied
      from guestbook
    `;

    const [views] = await sql<{ today: number; week: number; total: number }[]>`
      select
        coalesce(sum(count) filter (where day = current_date), 0)::int as today,
        coalesce(sum(count) filter (where day >= current_date - 6), 0)::int as week,
        coalesce(sum(count), 0)::int as total
      from page_views
    `;

    const topPaths = await sql<{ path: string; count: number }[]>`
      select path, sum(count)::int as count
      from page_views
      where day >= current_date - 29
      group by path
      order by count desc
      limit 10
    `;

    const daily = await sql<{ day: string; count: number }[]>`
      select day, sum(count)::int as count
      from page_views
      where day >= current_date - 13
      group by day
      order by day asc
    `;

    const entries = await sql<
      {
        id: string;
        name: string;
        message: string;
        created_at: string;
        score: number;
        status: string;
        pinned: boolean;
        reply: string | null;
      }[]
    >`
      select id, name, message, created_at, score, status, pinned, reply
      from guestbook
      order by created_at desc
      limit 100
    `;

    return json({
      visits: visits ? Number(visits.count) : 0,
      counts: counts ?? { total: 0, approved: 0, pending: 0, denied: 0 },
      views: views ?? { today: 0, week: 0, total: 0 },
      topPaths,
      daily,
      entries,
    });
  } catch {
    return fail(500);
  }
};
