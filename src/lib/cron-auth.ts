import { unauthorizedResponse } from "./guard";
import { secretsEqual } from "./secrets";

export function requireCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization")?.trim() ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!secret || !token || !secretsEqual(token, secret)) return unauthorizedResponse(request);
  return null;
}
