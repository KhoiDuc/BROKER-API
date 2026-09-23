import {
  corsPreflightResponse,
  jsonResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { getPortfolio, savePortfolio } from "@/lib/portfolio-service";
import { portfolioSchema } from "@/lib/schemas";
import type { BrokerPortfolioJson } from "@/lib/types";

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

  const parsed = await parseBody(request, portfolioSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const saved = await savePortfolio(parsed.data as BrokerPortfolioJson);
    return jsonResponse(saved, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save portfolio";
    console.error("[PUT /api/portfolio] SAVE FAIL:", error);
    return serverErrorResponse(message, request);
  }
}
