const MESSAGES: Record<number, string> = {
  400: "bad request",
  401: "unauthorized",
  403: "forbidden",
  404: "not found",
  413: "payload too large",
  415: "unsupported media type",
  429: "too many requests",
  500: "server error",
  503: "unavailable",
};

export function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...headers,
    },
  });
}

export function fail(
  status: number,
  detail?: string,
  headers: Record<string, string> = {},
): Response {
  const message =
    import.meta.env.DEV && detail ? detail : (MESSAGES[status] ?? "error");
  return json({ error: message }, status, headers);
}
