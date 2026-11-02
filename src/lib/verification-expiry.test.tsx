import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { verificationExpiry, type ExpiryRow } from "./verification-expiry";
import { ExpiryList } from "@/components/admin/VerificationExpiry";

const TODAY = "2026-11-02";
const row = (id: string, status: string, expiry: string | null): ExpiryRow => ({ id, title: `Listing ${id}`, location: "Tambaram", verification_status: status, verification_expiry: expiry });

describe("verification expiry", () => {
  const rows = [
    row("a", "verified", "2026-10-20"),
    row("b", "verified", "2026-11-30"),
    row("c", "partially_verified", "2026-11-05"),
    row("d", "verified", "2027-06-01"),
    row("e", "verified", null),
    row("f", "unverified", "2026-11-03"),
    row("g", "verified", "2026-12-02"),
  ];
  const r = verificationExpiry(rows, TODAY);

  it("sorts verified listings into expired, due within 30 days and no expiry", () => {
    expect(r.expired.map((x) => x.id)).toEqual(["a"]);
    expect(r.expired[0]?.daysLeft).toBe(-13);
    expect(r.dueSoon.map((x) => x.id)).toEqual(["c", "b", "g"]);
    expect(r.dueSoon[2]?.daysLeft).toBe(30);
    expect(r.noExpiry.map((x) => x.id)).toEqual(["e"]);
  });

  it("ignores unverified listings and far-off expiries", () => {
    const all = [...r.expired, ...r.dueSoon, ...r.noExpiry].map((x) => x.id);
    expect(all).not.toContain("f");
    expect(all).not.toContain("d");
  });

  it("renders the groups with days left, and an all-clear when nothing is due", () => {
    render(<ExpiryList report={r} />);
    expect(screen.getByTestId("expiry-group-expired")).toHaveTextContent("Listing a");
    expect(screen.getByTestId("expiry-group-expired")).toHaveTextContent("13 days ago");
    expect(screen.getByTestId("expiry-group-due-soon")).toHaveTextContent("in 3 days");
    expect(screen.getByTestId("expiry-group-no-expiry")).toHaveTextContent("Listing e");
  });

  it("says so plainly when nothing needs a re-check", () => {
    render(<ExpiryList report={verificationExpiry([], TODAY)} />);
    expect(screen.getByTestId("expiry-all-clear")).toBeInTheDocument();
  });
});
