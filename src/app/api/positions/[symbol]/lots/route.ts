import {
  corsPreflightResponse,
  jsonResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { addLot } from "@/lib/portfolio-service";
import { lotSchema } from "@/lib/schemas";
import type { BrokerLotJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  const parsed = await parseBody(request, lotSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const saved = await addLot(symbol, parsed.data as BrokerLotJson);
    return jsonResponse(saved, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found")) return notFoundResponse(request);
    console.error(`[POST /api/positions/${symbol}/lots]`, error);
    return serverErrorResponse(msg, request);
  }
}