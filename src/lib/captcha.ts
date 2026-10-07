const runtimeEnv = import.meta.env as Record<string, string | undefined>;

export function turnstileSecret(): string | undefined {
  return runtimeEnv.TURNSTILE_SECRET_KEY ?? process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyCaptcha(
  token: string,
  ip: string | null,
): Promise<boolean> {
  const secret = turnstileSecret();
  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip) {
    body.set("remoteip", ip);
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );

    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
