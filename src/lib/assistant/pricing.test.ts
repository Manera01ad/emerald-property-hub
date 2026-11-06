import { describe, expect, it } from "vitest";
import { AI_GATEWAY_URL, aiApiKey, aiProviderHeaders } from "./pricing";

/**
 * The provider is swappable by configuration. These tests pin the two things
 * that would silently break the swap: the key must be readable from the neutral
 * name (with the Lovable name as a fallback), and the Lovable-only headers must
 * be sent to the Lovable gateway and to nothing else.
 */
describe("aiApiKey", () => {
  it("prefers the neutral AI_API_KEY over the legacy LOVABLE_API_KEY", () => {
    const before = { ...process.env };
    process.env["AI_API_KEY"] = "neutral";
    process.env["LOVABLE_API_KEY"] = "legacy";
    expect(aiApiKey()).toBe("neutral");
    process.env = before;
  });

  it("falls back to the legacy name during migration", () => {
    const before = { ...process.env };
    delete process.env["AI_API_KEY"];
    process.env["LOVABLE_API_KEY"] = "legacy";
    expect(aiApiKey()).toBe("legacy");
    process.env = before;
  });
});

describe("aiProviderHeaders", () => {
  it("adds the Lovable gateway headers only for the Lovable gateway", () => {
    const headers = aiProviderHeaders("k");
    if (AI_GATEWAY_URL.includes("gateway.lovable.dev")) {
      expect(headers["Lovable-API-Key"]).toBe("k");
    } else {
      expect(headers).toEqual({});
    }
  });
});
