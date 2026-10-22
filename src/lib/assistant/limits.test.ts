import { describe, expect, it } from "vitest";
import { DAILY_MESSAGE_LIMIT, MAX_MESSAGE_CHARS, WINDOW_MS, checkMessage, messageText, windowStart } from "./limits";

const msg = (t: string) => ({ parts: [{ type: "text", text: t }] });

describe("assistant limits", () => {
  it("accepts a normal question and joins text parts only", () => {
    expect(checkMessage(msg("What does stamp duty cost?"))).toBeNull();
    expect(messageText({ parts: [{ type: "text", text: "a" }, { type: "reasoning", text: "x" }, { type: "text", text: "b" }] })).toBe("ab");
  });
  it("rejects empty and over-long messages", () => {
    expect(checkMessage(msg("   "))).toMatch(/type a question/);
    expect(checkMessage({ parts: [] })).toMatch(/type a question/);
    expect(checkMessage(msg("x".repeat(MAX_MESSAGE_CHARS)))).toBeNull();
    expect(checkMessage(msg("x".repeat(MAX_MESSAGE_CHARS + 1)))).toMatch(/under 1,000 characters/);
  });
  it("counts the last 24 hours", () => {
    const now = Date.UTC(2026, 9, 23, 12);
    expect(Date.parse(windowStart(now))).toBe(now - WINDOW_MS);
    expect(DAILY_MESSAGE_LIMIT).toBe(15);
  });
});
