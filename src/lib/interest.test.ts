import { describe, expect, it } from "vitest";
import { INTEREST_CONSENT_VERSION, interestRow, validateInterest } from "./interest";

describe("interest requests", () => {
  it("needs consent", () => {
    const r = validateInterest({ consent: false, message: "I would like to see this home" });
    expect(r.ok).toBe(false);
  });

  it("needs a real note", () => {
    expect(validateInterest({ consent: true, message: "ok" }).ok).toBe(false);
    expect(validateInterest({ consent: true, message: "Please arrange a visit this weekend" }).ok).toBe(true);
  });

  it("rejects an over-long note", () => {
    expect(validateInterest({ consent: true, message: "a".repeat(2001) }).ok).toBe(false);
  });

  it("always records consent and its wording version", () => {
    const row = interestRow({ propertyId: "p1", name: " Ravi ", phone: " 9876543210 ", email: null, message: "  Interested  " });
    expect(row.enquiry_type).toBe("interest");
    expect(row.property_id).toBe("p1");
    expect(row.consent).toBe(true);
    expect(row.consent_version).toBe(INTEREST_CONSENT_VERSION);
    expect(row.name).toBe("Ravi");
    expect(row.phone).toBe("9876543210");
    expect(row.message).toBe("Interested");
  });
});
