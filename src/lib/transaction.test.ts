import { describe, expect, it } from "vitest";

import {
  asTransactionType,
  budgetLabel,
  isCompleteForType,
  isTransactionType,
  missingTerms,
  priceFields,
  priceLabel,
  priceUnit,
  TRANSACTION_PARTICIPANTS,
} from "./transaction";

describe("transaction types", () => {
  it("recognises only the three supported types", () => {
    expect(isTransactionType("buy")).toBe(true);
    expect(isTransactionType("rent")).toBe(true);
    expect(isTransactionType("lease")).toBe(true);
    expect(isTransactionType("sublet")).toBe(false);
    expect(isTransactionType(undefined)).toBe(false);
  });

  it("falls back to buy rather than failing on an unknown value", () => {
    expect(asTransactionType("lease")).toBe("lease");
    expect(asTransactionType("nonsense")).toBe("buy");
    expect(asTransactionType(null)).toBe("buy");
  });

  it("labels the price in the unit that suits the type", () => {
    expect(priceUnit("buy")).toBe("total");
    expect(priceUnit("rent")).toBe("per_month");
    expect(priceUnit("lease")).toBe("per_month");
    expect(priceLabel("buy")).toBe("Asking price");
    expect(priceLabel("rent")).toBe("Monthly rent");
  });

  it("names each side of the transaction correctly", () => {
    expect(TRANSACTION_PARTICIPANTS.buy.provider).toBe("Seller");
    expect(TRANSACTION_PARTICIPANTS.rent.seeker).toBe("Tenant");
    expect(TRANSACTION_PARTICIPANTS.lease.provider).toBe("Lessor");
    expect(budgetLabel("buy")).toBe("Budget (₹ lakhs)");
    expect(budgetLabel("lease")).toBe("Monthly budget (₹)");
  });

  it("needs no extra terms to compare a sale", () => {
    expect(missingTerms("buy", {})).toEqual([]);
    expect(isCompleteForType("buy", {})).toBe(true);
  });

  it("lists the rental terms a comparison needs", () => {
    const gaps = missingTerms("rent", {
      deposit: 100000,
      maintenance_monthly: 0,
      furnishing: "unfurnished",
    });
    expect(gaps.map((g) => g.field).sort()).toEqual(["available_from"]);
  });

  it("treats an empty string as a missing term, not a stated one", () => {
    const gaps = missingTerms("lease", {
      lease_months: 36,
      deposit: 0,
      escalation_pct: 5,
      permitted_use: "  ",
      renewal_terms: "renewable",
    });
    expect(gaps.map((g) => g.field)).toEqual(["permitted_use"]);
    expect(
      isCompleteForType("lease", {
        lease_months: 36,
        deposit: 0,
        escalation_pct: 5,
        permitted_use: "office",
        renewal_terms: "renewable",
      }),
    ).toBe(true);
  });

  it("accepts a zero deposit and zero escalation as stated values", () => {
    const gaps = missingTerms("lease", {
      lease_months: 11,
      deposit: 0,
      escalation_pct: 0,
      permitted_use: "residential",
      renewal_terms: "not_renewable",
    });
    expect(gaps).toEqual([]);
  });
});

describe("price fields carry their unit", () => {
  it("gives a sale a price and no monthly figure", () => {
    expect(priceFields("buy", 8000000)).toEqual({ price: 8000000, monthly_figure: null, price_unit: "total" });
  });

  it("gives a rent a monthly figure and no price", () => {
    expect(priceFields("rent", 25000)).toEqual({ price: null, monthly_figure: 25000, price_unit: "per_month" });
  });

  it("gives a lease a monthly figure too", () => {
    expect(priceFields("lease", 40000).monthly_figure).toBe(40000);
    expect(priceFields("lease", 40000).price).toBeNull();
  });

  it("reports a missing figure as null rather than zero", () => {
    expect(priceFields("rent", null).monthly_figure).toBeNull();
    expect(priceFields("rent", undefined).monthly_figure).toBeNull();
    expect(priceFields("buy", "").price).toBeNull();
  });
});
