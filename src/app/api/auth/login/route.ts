import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/guard";
import { signAccessToken, validateTradingCredentials } from "@/lib/auth";

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
    console.error("[POST /api/auth/login]", error);
    return serverErrorResponse(message, request);
  }
}
