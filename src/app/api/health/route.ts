import { prisma } from "@/lib/prisma";
import { corsPreflightResponse, jsonResponse, serverErrorResponse } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonResponse({ ok: true, db: "up" }, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "database unreachable";
    return serverErrorResponse(message, request);
  }
}
