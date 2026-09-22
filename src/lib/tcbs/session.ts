import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/tcbs/crypto";
import type { EquityOrder } from "@/lib/tcbs/orderGuard";

export type TcbsExtras = {
  confirms?: Record<string, { hash: string; exp: number; order: EquityOrder }>;
  idempotency?: Record<string, { at: number; body: unknown }>;
  audit?: { at: string; action: string; detail: string }[];
  tickets?: Record<string, { stream: string; symbol: string; exp: number }>;
};

export type TcbsSessionView = {
  username: string;
  token: string;
  tokenExp: Date | null;
  custodyCode: string;
  accountNo: string;
  readOnly: boolean;
  needsReauth: boolean;
  extras: TcbsExtras;
};

function asExtras(value: Prisma.JsonValue): TcbsExtras {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as TcbsExtras;
}

export async function loadSession(username: string): Promise<TcbsSessionView | null> {
  const row = await prisma.tcbsSession.findUnique({ where: { username } });
  if (!row) return null;
  let token = "";
  try {
    token = decryptSecret(row.tokenEnc);
  } catch {
    token = "";
  }
  return {
    username: row.username,
    token,
    tokenExp: row.tokenExp,
    custodyCode: row.custodyCode,
    accountNo: row.accountNo,
    readOnly: row.readOnly,
    needsReauth: row.needsReauth || !token,
    extras: asExtras(row.extras),
  };
}

export async function saveConnected(input: {
  username: string;
  apiKey: string;
  token: string;
  tokenExp: Date | null;
  custodyCode: string;
  accountNo: string;
}) {
  const data = {
    apiKeyEnc: encryptSecret(input.apiKey),
    tokenEnc: encryptSecret(input.token),
    tokenExp: input.tokenExp,
    custodyCode: input.custodyCode,
    accountNo: input.accountNo,
    readOnly: true,
    needsReauth: false,
    extras: {} as Prisma.InputJsonValue,
  };
  await prisma.tcbsSession.upsert({
    where: { username: input.username },
    create: { username: input.username, ...data },
    update: data,
  });
}

export async function markReauth(username: string) {
  await prisma.tcbsSession.updateMany({
    where: { username },
    data: { needsReauth: true, tokenEnc: encryptSecret("") },
  });
}

export async function deleteTcbsSession(username: string) {
  await prisma.tcbsSession.deleteMany({ where: { username } });
}

export async function updateSession(
  username: string,
  patch: Partial<Pick<TcbsSessionView, "accountNo" | "readOnly" | "custodyCode" | "needsReauth">> & { extras?: TcbsExtras },
) {
  await prisma.tcbsSession.update({
    where: { username },
    data: {
      accountNo: patch.accountNo,
      readOnly: patch.readOnly,
      custodyCode: patch.custodyCode,
      needsReauth: patch.needsReauth,
      extras: patch.extras as Prisma.InputJsonValue | undefined,
    },
  });
}

export function pushAudit(extras: TcbsExtras, action: string, detail: string): TcbsExtras {
  const audit = [...(extras.audit ?? []), { at: new Date().toISOString(), action, detail }].slice(-200);
  return { ...extras, audit };
}
