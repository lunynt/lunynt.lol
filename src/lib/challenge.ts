import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const runtimeEnv = import.meta.env as Record<string, string | undefined>;
const TTL = 60 * 20;

function secret(): string | undefined {
  return (
    runtimeEnv.CAPTCHA_SECRET ??
    process.env.CAPTCHA_SECRET ??
    runtimeEnv.ADMIN_SECRET ??
    process.env.ADMIN_SECRET
  );
}

export function issueChallenge(): string | null {
  const value = secret();
  if (!value) {
    return null;
  }

  const exp = Math.floor(Date.now() / 1000) + TTL;
  const nonce = randomBytes(8).toString("hex");
  const payload = `${exp}.${nonce}`;
  return `${payload}.${createHmac("sha256", value).update(payload).digest("base64url")}`;
}

export function verifyChallenge(token: string): boolean {
  const value = secret();
  if (!value) {
    return true;
  }

  if (!token) {
    return false;
  }

  const [exp, nonce, signature] = token.split(".");
  if (!exp || !nonce || !signature) {
    return false;
  }

  const expected = createHmac("sha256", value)
    .update(`${exp}.${nonce}`)
    .digest("base64url");

  if (signature.length !== expected.length) {
    return false;
  }

  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return false;
  }

  const expires = Number(exp);
  return Number.isFinite(expires) && expires > Math.floor(Date.now() / 1000);
}
