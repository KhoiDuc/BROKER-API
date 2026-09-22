import crypto from "node:crypto";

function key(): Buffer {
  const raw = process.env.TCBS_ENC_KEY?.trim();
  if (!raw) throw new Error("TCBS_ENC_KEY is not set");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, data]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function randomId(): string {
  return crypto.randomBytes(16).toString("hex");
}
