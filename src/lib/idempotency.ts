import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export type IdempotencyClaim =
  | { status: "new" }
  | { status: "replay"; body: unknown }
  | { status: "pending" };

export async function claimIdempotency(username: string, key: string): Promise<IdempotencyClaim> {
  try {
    await prisma.orderIdempotency.create({
      data: { username, key, pending: true },
    });
    return { status: "new" };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }
    const row = await prisma.orderIdempotency.findUnique({
      where: { username_key: { username, key } },
    });
    if (!row || row.pending || row.body == null) return { status: "pending" };
    return { status: "replay", body: row.body };
  }
}

export async function completeIdempotency(username: string, key: string, body: unknown) {
  await prisma.orderIdempotency.update({
    where: { username_key: { username, key } },
    data: { pending: false, body: body as Prisma.InputJsonValue },
  });
}

export async function releaseIdempotency(username: string, key: string) {
  await prisma.orderIdempotency.deleteMany({ where: { username, key, pending: true } });
}
