import {
  corsPreflightResponse,
  jsonResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { archivePosition } from "@/lib/portfolio-service";
import { archiveSchema } from "@/lib/schemas";
import type { PositionStatus } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  const parsed = await parseBody(request, archiveSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const updated = await archivePosition(symbol, parsed.data.isArchived, parsed.data.status as PositionStatus | undefined);
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
