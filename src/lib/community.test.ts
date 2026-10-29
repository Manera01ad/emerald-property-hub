import { describe, expect, it } from "vitest";
import {
  AUTO_HIDE_REPORTS, canPostToday, containsContact, initialStatus, needsPreModeration,
  POSTS_PER_DAY_LIMIT, postsToday, shouldAutoHide, validatePost,
} from "./community";

const NOW = new Date("2026-06-01T12:00:00Z");

describe("post validation", () => {
  it("accepts a normal post", () => {
    expect(validatePost({ body: "Is the Potheri bus stand reachable on foot in the evening?" })).toEqual({ ok: true });
  });

  it("rejects a short body", () => {
    expect(validatePost({ body: "hi" }).ok).toBe(false);
  });

  it("rejects an over-long body", () => {
    expect(validatePost({ body: "a".repeat(2001) }).ok).toBe(false);
  });

  it("requires a real title on a thread and a known category", () => {
    expect(validatePost({ title: "ok", body: "A reasonable post body here." }).ok).toBe(false);
    expect(validatePost({ title: "Water supply in Guduvancheri", body: "A reasonable post body here.", category: "nonsense" }).ok).toBe(false);
    expect(validatePost({ title: "Water supply in Guduvancheri", body: "A reasonable post body here.", category: "localities" })).toEqual({ ok: true });
  });
});

describe("contact details are refused", () => {
  it("catches email addresses", () => {
    expect(containsContact("mail me at buyer@example.com")).toBe(true);
    expect(validatePost({ body: "mail me at buyer@example.com please" }).ok).toBe(false);
  });

  it("catches Indian mobile numbers in common shapes", () => {
    expect(containsContact("call 9876543210")).toBe(true);
    expect(containsContact("call +91 98765 43210")).toBe(true);
    expect(containsContact("call 98765 43210")).toBe(true);
    expect(containsContact("call 044-2345678")).toBe(false);
  });

  it("catches messaging links", () => {
    expect(containsContact("ping me on wa.me")).toBe(true);
    expect(containsContact("message on WhatsApp")).toBe(true);
  });

  it("catches a number in the title too", () => {
    expect(validatePost({ title: "Call 9876543210 for details", body: "A reasonable post body here." }).ok).toBe(false);
  });

  it("allows an ordinary post with numbers in it", () => {
    expect(containsContact("The 3BHK near the 200 feet road costs about 90 lakh.")).toBe(false);
  });
});

describe("pre-moderation", () => {
  it("queues a brand new account", () => {
    expect(needsPreModeration({ createdAt: "2026-05-30T12:00:00Z", approvedPosts: 0 }, NOW)).toBe(true);
    expect(initialStatus({ createdAt: "2026-05-30T12:00:00Z", approvedPosts: 0 }, NOW)).toBe("pending");
  });

  it("queues an older account that has never had a post approved", () => {
    expect(needsPreModeration({ createdAt: "2025-01-01T00:00:00Z", approvedPosts: 0 }, NOW)).toBe(true);
  });

  it("publishes for a settled account with an approved post", () => {
    expect(needsPreModeration({ createdAt: "2025-01-01T00:00:00Z", approvedPosts: 1 }, NOW)).toBe(false);
    expect(initialStatus({ createdAt: "2025-01-01T00:00:00Z", approvedPosts: 3 }, NOW)).toBe("published");
  });

  it("still queues an old account whose only posts were never approved", () => {
    expect(needsPreModeration({ createdAt: "2020-01-01T00:00:00Z", approvedPosts: 0 }, NOW)).toBe(true);
  });
});

describe("reporting", () => {
  it("hides at three distinct reporters, not two", () => {
    expect(shouldAutoHide(2)).toBe(false);
    expect(shouldAutoHide(AUTO_HIDE_REPORTS)).toBe(true);
    expect(shouldAutoHide(9)).toBe(true);
  });
});

describe("daily limit", () => {
  it("counts only the last 24 hours", () => {
    expect(postsToday(["2026-06-01T09:00:00Z", "2026-05-30T09:00:00Z"], NOW)).toBe(1);
  });

  it("stops at ten posts a day", () => {
    const ten = Array.from({ length: POSTS_PER_DAY_LIMIT }, (_, i) => `2026-06-01T0${i % 9}:00:00Z`);
    expect(canPostToday(ten, NOW)).toBe(false);
    expect(canPostToday(ten.slice(0, POSTS_PER_DAY_LIMIT - 1), NOW)).toBe(true);
  });
});
