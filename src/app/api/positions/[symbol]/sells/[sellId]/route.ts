import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  noContentResponse,
  notFoundResponse,
  requireApiKey,
  serverErrorResponse,
} from "@/lib/guard";
import { updateSell, deleteSell } from "@/lib/portfolio-service";
import type { BrokerSellJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ symbol: string; sellId: string }> },
) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const { symbol, sellId } = await params;
  let body: BrokerSellJson;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  try {
    const updated = await updateSell(symbol, sellId, body);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to update not found")) return notFoundResponse(request);
    console.error(`[PUT /api/positions/${symbol}/sells/${sellId}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ symbol: string; sellId: string }> },
) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const { symbol, sellId } = await params;
  try {
    await deleteSell(symbol, sellId);
    return noContentResponse(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to delete does not exist")) return notFoundResponse(request);
    console.error(`[DELETE /api/positions/${symbol}/sells/${sellId}]`, error);
    return serverErrorResponse(msg, request);
  }
}