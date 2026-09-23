import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { createPosition } from "@/lib/portfolio-service";
import { positionSchema } from "@/lib/schemas";
import type { BrokerPositionJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const parsed = await parseBody(request, positionSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data as BrokerPositionJson;

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