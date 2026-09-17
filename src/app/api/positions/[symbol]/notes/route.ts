import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { addNote } from "@/lib/portfolio-service";
import type { BrokerNoteJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol } = await params;
  let body: BrokerNoteJson;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", request);
  }

  if (!body?.at || !body?.text) {
    return badRequestResponse("at and text are required", request);
  }

  try {
    const saved = await addNote(symbol, body);
    return jsonResponse(saved, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found")) return notFoundResponse(request);
    console.error(`[POST /api/positions/${symbol}/notes]`, error);
    return serverErrorResponse(msg, request);
  }
}