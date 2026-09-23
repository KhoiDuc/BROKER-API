import { badRequestResponse, corsPreflightResponse, jsonResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { diffCsvImport, parsePortfolioCsv } from "@/lib/csv-portfolio";
import { getPortfolio } from "@/lib/portfolio-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const dryRun = new URL(request.url).searchParams.get("dryRun") !== "false";
  const text = await request.text();
  if (!text.trim()) return badRequestResponse("CSV body is empty", request);
  try {
    const rows = parsePortfolioCsv(text);
    const diff = diffCsvImport(await getPortfolio(), rows);
    if (dryRun) return jsonResponse({ dryRun: true, diff, rows: rows.slice(0, 50) }, request);
    return jsonResponse(
      {
        dryRun: false,
        applied: false,
        message: "CSV import preview only. Apply the reviewed JSON with PUT /api/portfolio.",
        diff,
      },
      request,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return serverErrorResponse(message, request);
  }
}
