import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { matchProperty, type Preferences } from "@/lib/buyer";
import type { CostRules } from "@/lib/deal";
import type { Property } from "@/lib/data";

function createListing(over: Record<string, unknown> = {}): Property {
  return {
    id: "p1",
    property_type: "apartment",
    location: "Tambaram",
    asking_price: 6000000,
    bedrooms: 2,
    built_area_sqft: 1000,
    land_area_sqft: null,
    verification_status: "unverified",
    ...over,
  } as never;
}

/**
 * Regression guards for seeker lease preferences and accessibility in My Property Research.
 */
describe("My Property Research lease preferences and accessibility", () => {
  const src = readFileSync("src/routes/_authenticated/my.tsx", "utf8");

  it("includes the Lease option in the intent selector", () => {
    expect(src).toContain('<option value="lease">Lease</option>');
  });

  it("labels the monthly budget field specifically when lease intent is chosen", () => {
    expect(src).toContain('f.intent === "lease" ? "Monthly lease budget (₹)" : "Monthly rent budget (₹)"');
  });

  it("displays an informative callout explaining pending migration 0019 status and linking to lease listings", () => {
    expect(src).toContain("Lease preferences (Preview)");
    expect(src).toContain("migration 0019");
    expect(src).toContain('search={{ transaction: "lease" }}');
  });

  it("gives every visible form Label an explicit htmlFor attribute", () => {
    const profileSection = src.substring(
      src.indexOf('<TabsContent value="profile"'),
      src.indexOf('</TabsContent>')
    );
    const labels = [...profileSection.matchAll(/<Label(?![A-Za-z])[^>]*>([\s\S]*?)<\/Label>/g)];
    expect(labels.length).toBeGreaterThan(0);

    // Exclude group section header labels that label button collections
    const fieldLabels = labels.filter((m) => {
      const text = m[1] ?? "";
      return !text.includes("Property types") && !text.includes("Preferred locations");
    });
    const withoutFor = fieldLabels.filter((m) => !m[0].includes("htmlFor="));
    expect(withoutFor).toEqual([]);
  });

  it("points every htmlFor to an element id existing in the file", () => {
    const targets = [...src.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]);
    expect(targets.length).toBeGreaterThan(0);

    for (const id of targets) {
      expect(src, `no element has id="${id}"`).toContain(`id="${id}"`);
    }
  });

  it("keeps input ids unique within the file", () => {
    const ids = [...src.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });

  it("handles unmigrated database constraint error gracefully in saveProfile", () => {
    expect(src).toContain("buyer_profiles_intent_check");
    expect(src).toContain("pending database migration 0019");
  });
});

describe("transaction-aware matching for lease and rent in seeker research", () => {
  const rules: CostRules = {
    stampDutyPct: 7,
    registrationPct: 2,
    legalFee: 25000,
  };

  const dummyLeaseListing = createListing({
    id: "lease-101",
    title: "Commercial Office Space in OMR",
    location: "OMR",
    property_type: "office",
    transaction_type: "lease",
    asking_price: 50000,
    bedrooms: null,
    built_area_sqft: 2000,
    land_area_sqft: null,
    verification_status: "verified",
    listing_permission: true,
    is_demo: false,
    transaction_terms: {
      deposit: 300000,
      lease_months: 36,
      escalation_pct: 5,
      permitted_use: "office",
      renewal_terms: "renewable",
    },
  });

  it("evaluates a lease listing against seeker monthly budget", () => {
    const pref: Preferences = {
      intent: "lease",
      property_types: ["office"],
      budget: 60000, // Monthly lease budget passed as effective budget
      preferred_locations: ["OMR"],
      bedrooms: null,
      min_area_sqft: 1500,
    };

    const match = matchProperty(dummyLeaseListing, pref, rules);
    expect(match.overall).toBe(100);

    const budgetFit = match.parts.find((p) => p.label === "Monthly rent fit");
    expect(budgetFit).toBeDefined();
    expect(budgetFit?.score).toBe(100);
    expect(budgetFit?.note).toContain("₹50,000 vs budget ₹60,000");
  });

  it("flags missing lease duration and escalation on incomplete lease listings", () => {
    const incompleteLease = createListing({
      ...dummyLeaseListing,
      transaction_terms: {
        deposit: null,
        lease_months: null,
        escalation_pct: null,
      },
    });

    const pref: Preferences = {
      intent: "lease",
      property_types: [],
      budget: 50000,
      preferred_locations: [],
      bedrooms: null,
      min_area_sqft: null,
    };

    const match = matchProperty(incompleteLease, pref, rules);
    expect(match.missing).toContain("Lease duration");
    expect(match.missing).toContain("Escalation clause");
    expect(match.missing).toContain("Deposit");
  });
});
