import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

const DEFAULT_EXPIRES_IN = "7d";

export type AuthPayload = {
  sub: string;
  username: string;
};

function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export function getJwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN?.trim() || DEFAULT_EXPIRES_IN;
}

export async function signAccessToken(username: string): Promise<{ token: string; expiresAt: string } | null> {
  const secret = getJwtSecret();
  if (!secret) return null;

  const expiresIn = getJwtExpiresIn();
  const token = await new SignJWT({ username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);

  const expiresAt = resolveExpiresAt(expiresIn);
  return { token, expiresAt };
}

function resolveExpiresAt(expiresIn: string): string {
  const match = /^(\d+)([smhd])$/.exec(expiresIn.trim());
  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  const ms = amount * (multipliers[unit] ?? multipliers.d);
  return new Date(Date.now() + ms).toISOString();
}

export async function verifyAccessToken(token: string): Promise<AuthPayload | null> {
  const secret = getJwtSecret();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    const username = typeof payload.username === "string" ? payload.username : payload.sub;
    if (typeof username !== "string" || !username.trim()) return null;
    return { sub: username, username };
  } catch {
    return null;
  }
}

export function getConfiguredUsername(): string | null {
  const username = process.env.TRADING_USERNAME?.trim();
  return username || null;
}

export function getConfiguredPasswordHash(): string | null {
  const hash = process.env.TRADING_PASSWORD_HASH?.trim();
  return hash || null;
}

export async function validateTradingCredentials(username: string, password: string): Promise<boolean> {
  const expectedUsername = getConfiguredUsername();
  const passwordHash = getConfiguredPasswordHash();
  if (!expectedUsername || !passwordHash) return false;

  if (!username.trim() || username.trim().toLowerCase() !== expectedUsername.toLowerCase()) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization")?.trim();
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  const token = auth.slice(7).trim();
  return token || null;
}
