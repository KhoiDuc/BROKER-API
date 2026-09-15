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

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET() {
  try {
    const portfolio = await getPortfolio();
    return jsonResponse(portfolio);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load portfolio";
    return serverErrorResponse(message);
  }
}

export async function PUT(request: Request) {
  const authError = requireApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as BrokerPortfolioJson;
    if (!body || !Array.isArray(body.positions)) {
      return badRequestResponse("Invalid portfolio payload");
    }

    const saved = await savePortfolio(body);
    return jsonResponse(saved);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save portfolio";
    return serverErrorResponse(message);
  }
}
