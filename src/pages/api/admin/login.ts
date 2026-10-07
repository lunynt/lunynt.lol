import type { APIRoute } from "astro";
import { verifyCaptcha } from "../../../lib/captcha";
import { databaseUrl, getSql } from "../../../lib/db";
import { allow, hashIp } from "../../../lib/rate";
import {
  checkCredentials,
  isSecureRequest,
  sessionCookie,
} from "../../../lib/admin";

export const prerender = false;

function clientIp(context: { clientAddress?: string }): string | null {
  try {
    return context.clientAddress ?? null;
  } catch {
    return null;
  }
}

export const POST: APIRoute = async (context) => {
  let username = "";
  let password = "";
  let token = "";

  try {
    const form = await context.request.formData();
    username = String(form.get("username") ?? "");
    password = String(form.get("password") ?? "");
    token = String(form.get("cf-turnstile-response") ?? "");
  } catch {
    return context.redirect("/admin/login?error=1", 303);
  }

  const ip = clientIp(context);

  const url = databaseUrl();
  if (url) {
    const sql = getSql(url);
    const allowed = await allow(
      sql,
      `admin-login:${hashIp(ip) ?? "unknown"}`,
      8,
      900,
    );
    if (!allowed) {
      return context.redirect("/admin/login?error=1", 303);
    }
  }

  if (!(await verifyCaptcha(token, ip)) || !checkCredentials(username, password)) {
    return context.redirect("/admin/login?error=1", 303);
  }

  const cookie = sessionCookie(isSecureRequest(context.request));
  if (!cookie) {
    return context.redirect("/admin/login?error=1", 303);
  }

  const response = context.redirect("/admin", 303);
  response.headers.append("set-cookie", cookie);
  return response;
};
