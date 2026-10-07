import type { APIRoute } from "astro";
import { issueChallenge } from "../../lib/challenge";
import { fail, json } from "../../lib/api";

export const prerender = false;

export const GET: APIRoute = () => {
  const token = issueChallenge();
  if (!token) {
    return fail(503, "challenge secret missing");
  }
  return json({ token });
};
