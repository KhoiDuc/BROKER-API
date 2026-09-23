import { badRequestResponse, corsPreflightResponse, jsonResponse, notFoundResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { notifyChannel } from "@/lib/notify";
import { parseBody } from "@/lib/parse-body";
import { prisma } from "@/lib/prisma";
import { alertFireSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const parsed = await parseBody(request, alertFireSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  try {
    const alert = await prisma.priceAlert.findUnique({ where: { id } });
    if (!alert || !alert.active) return notFoundResponse(request);
    const last = parsed.data.price;
    const target = Number(alert.price);
    const hit = alert.direction === "above" ? last >= target : last <= target;
    if (!hit) return jsonResponse({ fired: false }, request);
    const text = `${alert.symbol} ${alert.direction} ${target} (last ${last})`;
    const sent = await notifyChannel(alert.channel, text);
    if (!sent) return badRequestResponse("Không gửi được thông báo. Kiểm tra Discord hoặc Telegram trên server.", request);
    const row = await prisma.priceAlert.update({
      where: { id },
      data: { active: false, lastFiredAt: new Date(), triggeredAt: new Date(), triggeredPrice: last },
    });
    return jsonResponse({ fired: true, id: row.id, triggeredPrice: last }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fire alert";
    return serverErrorResponse(message, request);
  }
}
