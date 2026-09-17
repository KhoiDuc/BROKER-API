import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  noContentResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { updateLot, deleteLot } from "@/lib/portfolio-service";
import type { BrokerLotJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ symbol: string; lotId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol, lotId } = await params;
  let body: BrokerLotJson;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  try {
    const updated = await updateLot(symbol, lotId, body);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to update not found")) {
      return notFoundResponse(request);
    }
    console.error(`[PUT /api/positions/${symbol}/lots/${lotId}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ symbol: string; lotId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol, lotId } = await params;
  try {
    await deleteLot(symbol, lotId);
    return noContentResponse(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to delete does not exist")) {
      return notFoundResponse(request);
    }
    console.error(`[DELETE /api/positions/${symbol}/lots/${lotId}]`, error);
    return serverErrorResponse(msg, request);
  }
}