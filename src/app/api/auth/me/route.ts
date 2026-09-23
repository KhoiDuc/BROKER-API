import {
  corsPreflightResponse,
  jsonResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/guard";
import { extractBearerToken, verifyAccessToken } from "@/lib/auth";
import { isApiKeyToken } from "@/lib/secrets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    return unauthorizedResponse(request);
  }

  if (isApiKeyToken(token)) {
    return jsonResponse({ username: "api-key" }, request);
  }

  try {
    const payload = await verifyAccessToken(token);
    if (!payload) {
      return unauthorizedResponse(request);
    }

    return jsonResponse({ username: payload.username }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read session";
    console.error("[GET /api/auth/me]", error);
    return serverErrorResponse(message, request);
  }
}
