export function log(level: "info" | "error", msg: string, extra?: Record<string, unknown>) {
  const line = JSON.stringify({ level, msg, time: new Date().toISOString(), ...extra });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function requestId(request: Request): string {
  return request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
}
