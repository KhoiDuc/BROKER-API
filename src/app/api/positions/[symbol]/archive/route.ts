import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { archivePosition } from "@/lib/portfolio-service";
import type { PositionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

type ArchiveBody = {
  isArchived?: boolean;
  status?: PositionStatus;
};

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  let body: ArchiveBody;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  if (typeof body?.isArchived !== "boolean") {
    return badRequestResponse("isArchived (boolean) is required", request);
  }

  try {
    const updated = await archivePosition(symbol, body.isArchived, body.status);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to update not found")) {
      return notFoundResponse(request);
    }
    console.error(`[PATCH /api/positions/${symbol}/archive]`, error);
    return serverErrorResponse(msg, request);
  }
}
