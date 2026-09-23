import {
  corsPreflightResponse,
  jsonResponse,
  noContentResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { deleteDividend, updateDividend } from "@/lib/portfolio-service";
import { dividendSchema } from "@/lib/schemas";
import type { BrokerDividendJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ symbol: string; dividendId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol, dividendId } = await params;
  const parsed = await parseBody(request, dividendSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const updated = await updateDividend(symbol, dividendId, parsed.data as BrokerDividendJson);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to update not found")) return notFoundResponse(request);
    console.error(`[PUT /api/positions/${symbol}/dividends/${dividendId}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ symbol: string; dividendId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol, dividendId } = await params;
  try {
    await deleteDividend(symbol, dividendId);
    return noContentResponse(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to delete does not exist")) return notFoundResponse(request);
    console.error(`[DELETE /api/positions/${symbol}/dividends/${dividendId}]`, error);
    return serverErrorResponse(msg, request);
  }
}
