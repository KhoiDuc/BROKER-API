import { corsPreflightResponse, jsonResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { prisma } from "@/lib/prisma";
import { alertSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const rows = await prisma.priceAlert.findMany({ orderBy: { createdAt: "desc" } });
  return jsonResponse(
    rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      direction: row.direction,
      price: Number(row.price),
      channel: row.channel,
      active: row.active,
      lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
    })),
    request,
  );
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const parsed = await parseBody(request, alertSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const row = await prisma.priceAlert.create({
      data: {
        symbol: parsed.data.symbol.trim().toUpperCase(),
        direction: parsed.data.direction,
        price: parsed.data.price,
        channel: parsed.data.channel ?? "discord",
      },
    });
    return jsonResponse({ id: row.id, symbol: row.symbol, direction: row.direction, price: Number(row.price), channel: row.channel, active: row.active }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create alert";
    return serverErrorResponse(message, request);
  }
}
