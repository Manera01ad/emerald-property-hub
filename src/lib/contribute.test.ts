import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CHALLENGES, CONTRIBUTE_NOTICES, CONTRIBUTE_STEPS } from "./contribute";

/**
 * The page exists to be honest about challenges that cannot be started. These
 * checks are about the promises, because the risk here is not a crash: it is a
 * contributor doing unpaid work, or reading a proposal as a funded job.
 */
describe("challenge proposals", () => {
  it("each has a title, a summary and at least one acceptance criterion", () => {
    expect(CHALLENGES.length).toBeGreaterThan(0);
    for (const challenge of CHALLENGES) {
      expect(challenge.title.length, challenge.id).toBeGreaterThan(0);
      expect(challenge.summary.length, challenge.id).toBeGreaterThan(0);
      expect(challenge.done.length, challenge.id).toBeGreaterThan(0);
    }
  });

  it("uses unique ids", () => {
    const ids = CHALLENGES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never states a reward amount", () => {
    // A figure in this file would be read as a promise of payment.
    for (const challenge of CHALLENGES) {
      const text = `${challenge.title} ${challenge.summary} ${challenge.done.join(" ")}`;
      expect(text, challenge.id).not.toMatch(/₹|\bRs\.?\b|\bINR\b|\b\d{3,}\b/);
    }
  });

  it("does not promise payment, points or a guaranteed reward", () => {
    for (const challenge of CHALLENGES) {
      const text = `${challenge.title} ${challenge.summary}`;
      expect(text, challenge.id).not.toMatch(/paid|guaranteed|reward of|earn/i);
    }
  });
});

describe("the notices a contributor must see", () => {
  const all = CONTRIBUTE_NOTICES.join(" \n");

  it("says the challenges are proposed, not guaranteed", () => {
    expect(all).toMatch(/proposed challenges, not guaranteed paid opportunities/);
  });

  it("says funding must be confirmed before a task opens", () => {
    expect(all).toMatch(/only after the owner approves it and confirms funding/);
  });

  it("says consent is required and personal information stays private", () => {
    expect(all).toMatch(/consent/);
    expect(all).toMatch(/Personal information must remain private/);
  });

  it("says ownership and licensing need a written agreement", () => {
    expect(all).toMatch(/written contributor agreement and legal review/);
  });

  it("rules out referral and multi-level schemes", () => {
    expect(all).toMatch(/No referral, recruitment or multi-level rewards/);
  });

  it("tells contributors not to start paid work without written acceptance", () => {
    expect(all).toMatch(/without written acceptance of the task and reward/);
  });

  it("shows a sensible number of steps, in order", () => {
    expect(CONTRIBUTE_STEPS.length).toBeGreaterThanOrEqual(4);
    expect(CONTRIBUTE_STEPS[0]).toMatch(/owner publishes an approved challenge/i);
  });
});

describe("the page renders the notices", () => {
  const src = readFileSync("src/routes/contribute.tsx", "utf8");

  it("renders every notice", () => {
    // The page maps over the constants, so this checks the constants are used
    // rather than duplicated or dropped.
    expect(src).toContain("CONTRIBUTE_NOTICES");
    expect(src).toContain("CHALLENGES");
    expect(src).toContain("CONTRIBUTE_STEPS");
  });

  it("says plainly that nothing is open yet", () => {
    expect(src).toMatch(/These challenges are not open yet/);
    expect(src).toMatch(/Not open/);
  });

  it("does not hard-code a reward amount", () => {
    expect(src).not.toMatch(/₹\s?\d/);
  });
});
