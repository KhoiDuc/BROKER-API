import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { createPosition, getPortfolio } from "@/lib/portfolio-service";
import type { BrokerPositionJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  let body: BrokerPositionJson;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  if (!body?.symbol || body.symbol.trim().length < 3) {
    return badRequestResponse("Symbol is required (min 3 chars)", request);
  }

  try {
    const saved = await createPosition(body);
    return jsonResponse(saved, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Unique constraint")) {
      return badRequestResponse(`Position ${body.symbol} already exists`, request);
    }
    console.error("[POST /api/positions]", error);
    return serverErrorResponse(msg, request);
  }
}