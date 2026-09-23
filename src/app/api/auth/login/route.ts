import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/guard";
import { signAccessToken, validateTradingCredentials } from "@/lib/auth";
import { log, requestId } from "@/lib/log";
import { allowRequest, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

type LoginBody = {
  username?: string;
  password?: string;
};

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const reqId = requestId(request);
  const allowed = await allowRequest(`login:${clientIp(request)}`, 10, 15 * 60 * 1000).catch((error) => {
    log("error", "login-rate-limit", { reqId, error: error instanceof Error ? error.message : String(error) });
    return true;
  });
  if (!allowed) {
    return jsonResponse({ error: "Too many login attempts" }, request, { status: 429 });
  }

  let body: LoginBody;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!username || !password) {
    return badRequestResponse("Username and password are required", request);
  }

  try {
    const valid = await validateTradingCredentials(username, password);
    if (!valid) {
      return unauthorizedResponse(request);
    }

    const signed = await signAccessToken(username);
    if (!signed) {
      return serverErrorResponse("JWT_SECRET is not configured", request);
    }

    return jsonResponse(
      {
        token: signed.token,
        expiresAt: signed.expiresAt,
        username,
      },
      request
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    log("error", "login-failed", { reqId, error: message });
    return serverErrorResponse(message, request);
  }
}
