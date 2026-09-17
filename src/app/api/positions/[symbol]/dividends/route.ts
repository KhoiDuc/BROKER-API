import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { addDividend } from "@/lib/portfolio-service";
import type { BrokerDividendJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  let body: BrokerDividendJson;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  if (!body?.exDate || body.amountPerShare === undefined) {
    return badRequestResponse("exDate and amountPerShare are required", request);
  }

  try {
    const saved = await addDividend(symbol, body);
    return jsonResponse(saved, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found")) return notFoundResponse(request);
    console.error(`[POST /api/positions/${symbol}/dividends]`, error);
    return serverErrorResponse(msg, request);
  }
}