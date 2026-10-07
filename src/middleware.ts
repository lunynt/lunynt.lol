import { defineMiddleware } from "astro:middleware";

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const path = context.url.pathname;

  if (path.startsWith("/admin") || path.startsWith("/api/admin")) {
    response.headers.set("x-frame-options", "DENY");
    response.headers.set("x-content-type-options", "nosniff");
    response.headers.set("referrer-policy", "same-origin");
    response.headers.set("cache-control", "no-store");
    response.headers.set("permissions-policy", "interest-cohort=()");

    if (import.meta.env.PROD) {
      response.headers.set("content-security-policy", CSP);
    }
  }

  return response;
});
