import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Public pages must not promise negotiation or brokerage. Internal CRM stage names
 * (admin dashboard, enquiry statuses) are not public copy and are out of scope here.
 */
const PUBLIC_PAGES = [
  "src/routes/index.tsx",
  "src/routes/consult.tsx",
  "src/routes/properties.$id.tsx",
  "src/routes/properties.index.tsx",
  "src/routes/explore.tsx",
  "src/routes/location-intelligence.index.tsx",
  "src/routes/location-intelligence.$area.tsx",
  "src/routes/research-services.tsx",
  "src/routes/contact.tsx",
  "src/routes/terms.tsx",
  "src/routes/disclaimer.tsx",
  "src/routes/privacy.tsx",
  "src/components/SiteHeader.tsx",
  "src/components/EnquiryForm.tsx",
  "src/components/PropertyCard.tsx",
  "src/lib/deal.ts",
];

const FORBIDDEN = /\b(negotiat\w*|brokerage|broker\b)/i;

function visibleText(source: string): string {
  return source
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .join("\n");
}

describe("public copy", () => {
  it.each(PUBLIC_PAGES)("%s does not promise negotiation or brokerage", (file) => {
    const text = visibleText(readFileSync(resolve(process.cwd(), file), "utf8"));
    const match = text.match(FORBIDDEN);
    expect(match?.[0] ?? null).toBeNull();
  });

  it("the property page labels price prompts as questions to ask", () => {
    const page = readFileSync(resolve(process.cwd(), "src/routes/properties.$id.tsx"), "utf8");
    expect(page).toContain("Questions to ask on price");
  });
});
