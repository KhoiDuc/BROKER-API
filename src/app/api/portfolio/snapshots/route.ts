import { Prisma } from "@prisma/client";
import { corsPreflightResponse, jsonResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { summarizePortfolio } from "@/lib/portfolio-math";
import { getPortfolio } from "@/lib/portfolio-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const rows = await prisma.portfolioSnapshot.findMany({ orderBy: { takenAt: "asc" }, take: 400 });
  return jsonResponse(
    rows.map((row) => ({
      id: row.id,
      takenAt: row.takenAt.toISOString(),
      nav: Number(row.nav),
      realizedPnl: Number(row.realizedPnl),
      unrealizedPnl: row.unrealizedPnl == null ? null : Number(row.unrealizedPnl),
      dividendIncome: Number(row.dividendIncome),
      breakdown: row.breakdown,
    })),
    request,
  );
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  try {
    const portfolio = await getPortfolio();
    const summary = summarizePortfolio(portfolio);
    const row = await prisma.portfolioSnapshot.create({
      data: {
        nav: summary.nav,
        realizedPnl: summary.realizedPnl,
        unrealizedPnl: summary.unrealizedPnl,
        dividendIncome: summary.dividendIncome,
        breakdown: summary.breakdown as Prisma.InputJsonValue,
      },
    });
    return jsonResponse({ id: row.id, takenAt: row.takenAt.toISOString(), ...summary }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snapshot failed";
    return serverErrorResponse(message, request);
  }
}
