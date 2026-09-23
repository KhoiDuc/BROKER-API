import { prisma } from "./prisma";

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Returns true when the caller is still inside the window limit. */
export async function allowRequest(bucket: string, limit: number, windowMs: number): Promise<boolean> {
  const windowEnd = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowEnd")
    VALUES (${bucket}, 1, ${windowEnd})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."windowEnd" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "windowEnd" = CASE
        WHEN "RateLimitBucket"."windowEnd" <= NOW() THEN ${windowEnd}
        ELSE "RateLimitBucket"."windowEnd"
      END
    RETURNING "count"
  `;
  return Number(rows[0]?.count ?? 0) <= limit;
}
