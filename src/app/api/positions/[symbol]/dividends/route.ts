import {
  corsPreflightResponse,
  jsonResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { addDividend } from "@/lib/portfolio-service";
import { dividendSchema } from "@/lib/schemas";
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
  const parsed = await parseBody(request, dividendSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const saved = await addDividend(symbol, parsed.data as BrokerDividendJson);
    return jsonResponse(saved, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found")) return notFoundResponse(request);
    console.error(`[POST /api/positions/${symbol}/dividends]`, error);
    return serverErrorResponse(msg, request);
  }
}