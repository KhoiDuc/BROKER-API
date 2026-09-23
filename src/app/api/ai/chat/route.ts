import { corsPreflightResponse, jsonResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { allowRequest, clientIp } from "@/lib/rate-limit";
import { parseBody } from "@/lib/parse-body";
import { aiChatSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function POST(request: Request) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const allowed = await allowRequest(`ai:${clientIp(request)}`, 30, 60 * 60 * 1000).catch(() => true);
  if (!allowed) return jsonResponse({ error: "Too many AI requests" }, request, { status: 429 });

  const parsed = await parseBody(request, aiChatSchema);
  if (!parsed.ok) return parsed.response;

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return serverErrorResponse("GEMINI_API_KEY is not configured", request);

  const model = parsed.data.model || process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: parsed.data.prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
    }),
  });
  const payload = (await upstream.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  } | null;
  if (!upstream.ok) {
    return jsonResponse({ error: payload?.error?.message || "Gemini request failed" }, request, { status: 502 });
  }
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  return jsonResponse({ text, model }, request);
}
