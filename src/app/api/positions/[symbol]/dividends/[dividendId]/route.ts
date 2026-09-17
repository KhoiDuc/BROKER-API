import {
  corsPreflightResponse,
  noContentResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { deleteDividend } from "@/lib/portfolio-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
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
    if (msg.includes("Record to delete does not exist")) return notFoundResponse(request);
    console.error(`[DELETE /api/positions/${symbol}/dividends/${dividendId}]`, error);
    return serverErrorResponse(msg, request);
  }
}