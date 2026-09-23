import { createHash, timingSafeEqual } from "node:crypto";

/** Compare secrets without leaking length or prefix through timing. */
export function secretsEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

export function isApiKeyToken(token: string): boolean {
  const apiKey = process.env.API_KEY?.trim();
  if (!apiKey || !token) return false;
  return secretsEqual(token, apiKey);
}
