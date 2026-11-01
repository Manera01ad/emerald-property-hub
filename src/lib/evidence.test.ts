import { describe, expect, it } from "vitest";
import {
  EVIDENCE_HELP,
  EVIDENCE_LABELS,
  EVIDENCE_ORDER,
  evidenceRank,
  weakerEvidence,
  type Evidence,
} from "./evidence";

/**
 * The directive requires six labels; the code carried four. The tests below pin
 * the set and, more importantly, the rule that combining labels descends rather
 * than ascends, because that rule is what stops a resident's report being shown
 * as an official figure.
 */
const REQUIRED: Evidence[] = [
  "VERIFIED",
  "OFFICIAL_SOURCE",
  "COMMUNITY_REPORTED",
  "ESTIMATE",
  "CLAIM",
  "UNKNOWN",
];

describe("the evidence label set", () => {
  it("has all six required labels", () => {
    expect(Object.keys(EVIDENCE_LABELS).sort()).toEqual([...REQUIRED].sort());
  });

  it("gives every label a human-readable name", () => {
    for (const key of REQUIRED) {
      expect(EVIDENCE_LABELS[key].length, key).toBeGreaterThan(0);
    }
  });

  it("gives every label an explanation", () => {
    expect(Object.keys(EVIDENCE_HELP).sort()).toEqual([...REQUIRED].sort());
    for (const key of REQUIRED) {
      expect(EVIDENCE_HELP[key].length, key).toBeGreaterThan(0);
    }
  });

  it("lists every label exactly once in the order", () => {
    expect([...EVIDENCE_ORDER].sort()).toEqual([...REQUIRED].sort());
    expect(new Set(EVIDENCE_ORDER).size).toBe(EVIDENCE_ORDER.length);
  });

  it("keeps OFFICIAL_SOURCE and COMMUNITY_REPORTED distinct", () => {
    // Flattening these two would let a community report inherit the weight of an
    // official publication.
    expect(EVIDENCE_LABELS.OFFICIAL_SOURCE).not.toBe(EVIDENCE_LABELS.COMMUNITY_REPORTED);
  });

  it("does not describe a community report as checked", () => {
    expect(EVIDENCE_HELP.COMMUNITY_REPORTED).toMatch(/Not independently checked/);
  });
});

describe("evidenceRank", () => {
  it("ranks the strongest label first", () => {
    expect(evidenceRank("VERIFIED")).toBe(0);
    expect(evidenceRank("OFFICIAL_SOURCE")).toBe(1);
  });

  it("ranks a community report above an estimate but below an official source", () => {
    expect(evidenceRank("COMMUNITY_REPORTED")).toBeLessThan(evidenceRank("ESTIMATE"));
    expect(evidenceRank("COMMUNITY_REPORTED")).toBeGreaterThan(evidenceRank("OFFICIAL_SOURCE"));
  });

  it("treats a missing label as the weakest", () => {
    expect(evidenceRank(null)).toBeGreaterThan(evidenceRank("UNKNOWN"));
    expect(evidenceRank(undefined)).toBeGreaterThan(evidenceRank("UNKNOWN"));
  });
});

describe("weakerEvidence", () => {
  it("returns the weaker of two labels", () => {
    expect(weakerEvidence("VERIFIED", "CLAIM")).toBe("CLAIM");
    expect(weakerEvidence("CLAIM", "VERIFIED")).toBe("CLAIM");
  });

  it("returns the label itself when both are the same", () => {
    expect(weakerEvidence("ESTIMATE", "ESTIMATE")).toBe("ESTIMATE");
  });

  it("never promotes a community report to an official source", () => {
    expect(weakerEvidence("COMMUNITY_REPORTED", "OFFICIAL_SOURCE")).toBe("COMMUNITY_REPORTED");
    expect(weakerEvidence("OFFICIAL_SOURCE", "COMMUNITY_REPORTED")).toBe("COMMUNITY_REPORTED");
  });

  it("never promotes anything to VERIFIED unless both are VERIFIED", () => {
    for (const other of REQUIRED) {
      const result = weakerEvidence("VERIFIED", other);
      expect(result, `VERIFIED + ${other}`).toBe(other === "VERIFIED" ? "VERIFIED" : other);
    }
  });

  it("is commutative, so the caller's argument order cannot change the answer", () => {
    for (const a of REQUIRED) {
      for (const b of REQUIRED) {
        expect(weakerEvidence(a, b), `${a} + ${b}`).toBe(weakerEvidence(b, a));
      }
    }
  });
});
