import { prisma } from "@/lib/prisma";
import { randomId } from "@/lib/tcbs/crypto";

const TICKET_TTL_MS = 60_000;

export async function issueWsTicket(username: string, stream: string, symbol: string) {
  const ticket = randomId();
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);
  await prisma.wsTicket.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.wsTicket.create({
    data: { id: ticket, username, stream, symbol, expiresAt },
  });
  return { ticket, expiresInSec: TICKET_TTL_MS / 1000 };
}

export async function redeemWsTicket(ticket: string) {
  const now = new Date();
  const claimed = await prisma.wsTicket.updateMany({
    where: { id: ticket, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count === 0) return null;
  return prisma.wsTicket.findUnique({ where: { id: ticket } });
}
