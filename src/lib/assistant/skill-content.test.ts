/**
 * Content guards for the two skills that were corrected.
 *
 * The general skill tests check structure. These check the promises, because
 * what went wrong was not a broken file: the membership skill described Plus and
 * Pro features and said prices would be displayed, which reads as an offer for
 * something nobody can buy.
 */
import { describe, expect, it } from "vitest";
import { findSkill } from "./skills";
import { SKILLS } from "./skill-files";

const membership = findSkill(SKILLS, "membership-entitlement");
const contributor = findSkill(SKILLS, "contributor-challenge");

describe("membership-entitlement", () => {
  it("exists", () => {
    expect(membership).not.toBeNull();
  });

  it("says plainly that paid memberships are not available", () => {
    expect(membership!.body).toMatch(/Paid memberships are not available/);
  });

  it("says a user cannot currently buy Plus or Pro", () => {
    expect(membership!.body).toMatch(/no Plus plan and no Pro plan that\s+anyone can buy today/);
  });

  it("forbids promising a paid entitlement", () => {
    expect(membership!.body).toMatch(/Never promise a paid entitlement/);
  });

  it("points to the Consult page", () => {
    expect(membership!.body).toMatch(/Consult page/);
  });

  it("no longer lists Plus or Pro features as a menu of what you get", () => {
    // The old text had a "- Plus: ..." list. A feature list reads as an offer.
    expect(membership!.body).not.toMatch(/^-\s*Plus:/m);
    expect(membership!.body).not.toMatch(/^-\s*Pro:/m);
  });

  it("no longer says prices are shown", () => {
    expect(membership!.body).not.toMatch(/prices shown|shown are proposed/i);
  });
});

describe("contributor-challenge", () => {
  it("exists", () => {
    expect(contributor).not.toBeNull();
  });

  it("points to the Contribute page", () => {
    expect(contributor!.body).toMatch(/Contribute page/);
  });

  it("no longer defers to unspecified repository contribution rules", () => {
    expect(contributor!.body).not.toMatch(/repository's contribution rules/i);
  });

  it("does not claim a challenge is already open or funded", () => {
    expect(contributor!.body).toMatch(/are not open/);
    expect(contributor!.body).toMatch(
      /only after the owner approves it and confirms the\s+funding/,
    );
  });

  it("still refuses referral and multi-level schemes", () => {
    expect(contributor!.body).toMatch(/referral, recruitment or multi-level reward/);
  });
});
