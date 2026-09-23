import { withCors, corsPreflightResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { portfolioToCsv } from "@/lib/csv-portfolio";
import { getPortfolio } from "@/lib/portfolio-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  try {
    const csv = portfolioToCsv(await getPortfolio());
    return withCors(
      new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=portfolio.csv",
        },
      }),
      request,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return serverErrorResponse(message, request);
  }
}
