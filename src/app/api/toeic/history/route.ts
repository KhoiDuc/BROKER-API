import {
  badRequestResponse,
  corsPreflightResponse,
  jsonResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { extractBearerToken, verifyAccessToken } from "@/lib/auth";
import { isApiKeyToken } from "@/lib/secrets";
import { parseBody } from "@/lib/parse-body";
import { prisma } from "@/lib/prisma";
import { toeicDailySchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

async function resolveUsername(request: Request): Promise<string | null> {
  const token = extractBearerToken(request);
  if (!token) return null;
  if (isApiKeyToken(token)) return "api-key";
  const payload = await verifyAccessToken(token);
  return payload?.username ?? null;
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const username = await resolveUsername(request);
  if (!username) return badRequestResponse("Unable to resolve username", request);

  const url = new URL(request.url);
  const dateKey = url.searchParams.get("dateKey")?.trim();

  try {
    if (dateKey) {
      const entry = await prisma.toeicDailyHistory.findUnique({
        where: { username_dateKey: { username, dateKey } },
      });
      return jsonResponse({ entry }, request);
    }

    const entries = await prisma.toeicDailyHistory.findMany({
      where: { username },
      orderBy: { dateKey: "desc" },
      take: 365,
    });
    return jsonResponse({ entries }, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[GET /api/toeic/history]", error);
    return serverErrorResponse(msg, request);
  }
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const username = await resolveUsername(request);
  if (!username) return badRequestResponse("Unable to resolve username", request);

  const parsed = await parseBody(request, toeicDailySchema);
  if (!parsed.ok) return parsed.response;

  const { dateKey, topicId, words } = parsed.data;

  try {
    const entry = await prisma.toeicDailyHistory.upsert({
      where: { username_dateKey: { username, dateKey } },
      create: { username, dateKey, topicId, words },
      update: { topicId, words },
    });
    return jsonResponse({ entry }, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[POST /api/toeic/history]", error);
    return serverErrorResponse(msg, request);
  }
}
