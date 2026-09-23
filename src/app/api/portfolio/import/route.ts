import { badRequestResponse, corsPreflightResponse, jsonResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { diffCsvImport, parsePortfolioCsv, previewHash, rowsToPortfolio } from "@/lib/csv-portfolio";
import { getPortfolio, savePortfolio } from "@/lib/portfolio-service";

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
    const hash = previewHash(rows);
    if (dryRun) return jsonResponse({ dryRun: true, diff, previewHash: hash, rows: rows.slice(0, 50) }, request);
    const sent = new URL(request.url).searchParams.get("previewHash");
    if (!sent || sent !== hash) {
      return badRequestResponse("Bản xem trước đã cũ. Xem lại diff trước khi ghi.", request);
    }
    await savePortfolio(rowsToPortfolio(rows));
    return jsonResponse({ dryRun: false, applied: true, previewHash: hash, diff }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return serverErrorResponse(message, request);
  }
}
