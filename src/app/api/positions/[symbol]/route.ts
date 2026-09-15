import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  noContentResponse,
  notFoundResponse,
  requireApiKey,
  serverErrorResponse,
} from "@/lib/guard";
import { updatePosition, deletePosition, archivePosition } from "@/lib/portfolio-service";
import type { BrokerPositionJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PUT(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const { symbol } = await params;
  let body: BrokerPositionJson;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  try {
    const updated = await updatePosition(symbol, body);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to update not found")) {
      return notFoundResponse(request);
    }
    console.error(`[PUT /api/positions/${symbol}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  const { symbol } = await params;
  try {
    await deletePosition(symbol);
    return noContentResponse(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Record to delete does not exist")) {
      return notFoundResponse(request);
    }
    console.error(`[DELETE /api/positions/${symbol}]`, error);
    return serverErrorResponse(msg, request);
  }
}