import { Prisma } from "@prisma/client";
import { requireCron } from "@/lib/cron-auth";
import { jsonResponse, serverErrorResponse } from "@/lib/guard";
import { summarizePortfolio } from "@/lib/portfolio-math";
import { getPortfolio } from "@/lib/portfolio-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  try {
    const summary = summarizePortfolio(await getPortfolio());
    const row = await prisma.portfolioSnapshot.create({
      data: {
        nav: summary.nav,
        realizedPnl: summary.realizedPnl,
        unrealizedPnl: summary.unrealizedPnl,
        dividendIncome: summary.dividendIncome,
        breakdown: summary.breakdown as Prisma.InputJsonValue,
      },
    });
    return jsonResponse({ id: row.id, takenAt: row.takenAt.toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Snapshot cron failed";
    return serverErrorResponse(message);
  }
}
