import type { APIRoute } from "astro";
import { clearCookie } from "../../../lib/admin";

export const prerender = false;

const handler: APIRoute = async (context) => {
  const response = context.redirect("/admin/login", 303);
  response.headers.append("set-cookie", clearCookie());
  return response;
};

export const POST = handler;
export const GET = handler;
