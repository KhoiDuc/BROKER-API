import { NextResponse } from "next/server";
import { extractBearerToken, verifyAccessToken } from "@/lib/auth";
import { isApiKeyToken } from "@/lib/secrets";

const allowedOrigins: string[] = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function resolveOrigin(request: Request): string | null {
  const origin = request.headers.get("origin")?.trim();
  if (!origin) return null;
  return allowedOrigins.includes(origin) ? origin : null;
}

export function withCors(response: NextResponse, request?: Request): NextResponse {
  const origin = request ? resolveOrigin(request) : null;
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key");
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

export function corsPreflightResponse(request: Request): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export function jsonResponse(data: unknown, request?: Request, init?: ResponseInit): NextResponse {
  return withCors(NextResponse.json(data, init), request);
}

export function noContentResponse(request?: Request): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

export function unauthorizedResponse(request?: Request): NextResponse {
  return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
}

export function badRequestResponse(message: string, request?: Request): NextResponse {
  return withCors(NextResponse.json({ error: message }, { status: 400 }), request);
}

export function notFoundResponse(request?: Request): NextResponse {
  return withCors(NextResponse.json({ error: "Not found" }, { status: 404 }), request);
}

export function serverErrorResponse(message: string, request?: Request): NextResponse {
  return withCors(NextResponse.json({ error: message }, { status: 500 }), request);
}

export async function requireAuth(request: Request): Promise<NextResponse | null> {
  const token = extractBearerToken(request);
  if (!token) {
    return unauthorizedResponse(request);
  }

  if (isApiKeyToken(token)) {
    return null;
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return unauthorizedResponse(request);
  }

  return null;
}