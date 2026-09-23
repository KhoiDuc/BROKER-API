import {
  corsPreflightResponse,
  jsonResponse,
  noContentResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { deletePosition, getPosition, updatePositionFull } from "@/lib/portfolio-service";
import { positionSchema } from "@/lib/schemas";
import type { BrokerPositionJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  try {
    const position = await getPosition(symbol);
    if (!position) return notFoundResponse(request);
    return jsonResponse(position, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[GET /api/positions/${symbol}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  const parsed = await parseBody(request, positionSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const updated = await updatePositionFull(symbol, { ...parsed.data, symbol } as BrokerPositionJson);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to update not found")) {
      return notFoundResponse(request);
    }
    console.error(`[PUT /api/positions/${symbol}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  try {
    await deletePosition(symbol);
    return noContentResponse(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to delete does not exist")) {
      return notFoundResponse(request);
    }
    console.error(`[DELETE /api/positions/${symbol}]`, error);
    return serverErrorResponse(msg, request);
  }
}
