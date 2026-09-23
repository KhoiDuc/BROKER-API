import { requireCron } from "@/lib/cron-auth";
import { jsonResponse, serverErrorResponse } from "@/lib/guard";
import { notifyChannel } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { fetchLastPrice } from "@/lib/quotes";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const denied = requireCron(request);
  if (denied) return denied;
  try {
    const alerts = await prisma.priceAlert.findMany({ where: { active: true } });
    const prices = new Map<string, number | null>();
    let fired = 0;
    for (const alert of alerts) {
      if (!prices.has(alert.symbol)) prices.set(alert.symbol, await fetchLastPrice(alert.symbol));
      const last = prices.get(alert.symbol);
      if (last == null) continue;
      const target = Number(alert.price);
      const hit = alert.direction === "above" ? last >= target : last <= target;
      if (!hit) continue;
      const text = `${alert.symbol} ${alert.direction} ${target} (last ${last})`;
      const sent = await notifyChannel(alert.channel, text);
      if (!sent) continue;
      fired++;
      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: { lastFiredAt: new Date(), active: false },
      });
    }
    return jsonResponse({ checked: alerts.length, fired });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Alert cron failed";
    return serverErrorResponse(message);
  }
}
