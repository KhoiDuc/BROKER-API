import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  requireApiKey,
  serverErrorResponse,
} from "@/lib/guard";
import { getPortfolio, savePortfolio } from "@/lib/portfolio-service";
import type { BrokerPortfolioJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
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
  const authError = requireApiKey(request);
  if (authError) return authError;

  let body: BrokerPortfolioJson;
  try {
    body = (await request.json()) as BrokerPortfolioJson;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body";
    console.error("[PUT /api/portfolio] JSON parse fail:", error);
    return badRequestResponse(`Invalid JSON: ${message}`, request);
  }

  if (!body || !Array.isArray(body.positions)) {
    return badRequestResponse("Invalid portfolio payload — positions must be an array", request);
  }

  const positionCount = body.positions.length + (body.closedPositions?.length ?? 0);
  console.log(`[PUT /api/portfolio] Saving ${positionCount} positions…`);

  try {
    const saved = await savePortfolio(body);
    console.log(`[PUT /api/portfolio] OK — saved ${saved.positions.length} active, ${saved.closedPositions?.length ?? 0} closed`);
    return jsonResponse(saved, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save portfolio";
    console.error("[PUT /api/portfolio] SAVE FAIL:", error);
    return serverErrorResponse(message, request);
  }
}