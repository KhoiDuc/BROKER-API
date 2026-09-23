import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, randomId } from "./crypto";

describe("tcbs crypto", () => {
  it("round-trips a secret", () => {
    process.env.TCBS_ENC_KEY = "test-key";
    const encrypted = encryptSecret("api-key-value");
    expect(decryptSecret(encrypted)).toBe("api-key-value");
    expect(encrypted).not.toContain("api-key-value");
  });

  it("issues unique ids", () => {
    expect(randomId()).not.toBe(randomId());
    expect(randomId()).toHaveLength(32);
  });
});
