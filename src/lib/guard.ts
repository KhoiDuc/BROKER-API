import { NextResponse } from "next/server";

const corsHeaders = (): HeadersInit => {
  const origin = process.env.ALLOWED_ORIGIN?.trim();
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
};

export function withCors(response: NextResponse): NextResponse {
  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

export function corsPreflightResponse(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}

export function jsonResponse(data: unknown, init?: ResponseInit): NextResponse {
  return withCors(NextResponse.json(data, init));
}

export function unauthorizedResponse(): NextResponse {
  return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
}

export function badRequestResponse(message: string): NextResponse {
  return withCors(NextResponse.json({ error: message }, { status: 400 }));
}

export function serverErrorResponse(message: string): NextResponse {
  return withCors(NextResponse.json({ error: message }, { status: 500 }));
}

export function requireApiKey(request: Request): NextResponse | null {
  const expected = process.env.API_KEY?.trim();
  if (!expected) {
    return serverErrorResponse("API_KEY is not configured");
  }

  const auth = request.headers.get("authorization")?.trim();
  if (!auth || auth !== `Bearer ${expected}`) {
    return unauthorizedResponse();
  }

  return null;
}
