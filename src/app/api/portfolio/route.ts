import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { createPosition, getPortfolio } from "@/lib/portfolio-service";
import type { BrokerPositionJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const portfolio = await getPortfolio();
    return jsonResponse(portfolio, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load portfolio";
    console.error("[GET /api/portfolio]", error);
    return serverErrorResponse(message, request);
  }
}

export async function PUT(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  let body: BrokerPositionJson & { closedPositions?: BrokerPositionJson[] };
  try {
    body = await request.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    return badRequestResponse(`Invalid JSON: ${message}`, request);
  }

  if (!body || !Array.isArray((body as any).positions)) {
    return badRequestResponse("Invalid portfolio payload — positions must be an array", request);
  }

  try {
    const { savePortfolio } = await import("@/lib/portfolio-service");
    const saved = await savePortfolio(body as any);
    return jsonResponse(saved, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save portfolio";
    console.error("[PUT /api/portfolio] SAVE FAIL:", error);
    return serverErrorResponse(message, request);
  }
}