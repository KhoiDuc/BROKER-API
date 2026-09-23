import type { ZodType } from "zod";
import { badRequestResponse } from "./guard";

export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: badRequestResponse("Invalid JSON body", request) };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
    return { ok: false, response: badRequestResponse(message, request) };
  }
  return { ok: true, data: parsed.data };
}
