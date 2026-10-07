export type JsonResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number };

export async function readJson(
  request: Request,
  maxBytes = 4096,
): Promise<JsonResult> {
  const header = request.headers.get("content-length");
  if (header) {
    const length = Number(header);
    if (Number.isFinite(length) && length > maxBytes) {
      return { ok: false, status: 413 };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }

  if (text.length > maxBytes) {
    return { ok: false, status: 413 };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function isJson(request: Request): boolean {
  const type = request.headers.get("content-type") ?? "";
  return type.toLowerCase().includes("application/json");
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  const host = request.headers.get("host");
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
