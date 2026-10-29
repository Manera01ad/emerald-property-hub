import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { TRANSACTION_LABELS, priceFields, termsOf, transactionTypeOf, type TransactionFields } from "@/lib/transaction";
import { supabaseForUser } from "../supabase";

/** The listing columns this tool returns. See search-listings.ts for why this is structural. */
type ListingRow = TransactionFields & {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  address: string | null;
  property_type: string | null;
  asking_price: number | null;
  guideline_value: number | null;
  bedrooms: number | null;
  built_area_sqft: number | null;
  land_area_sqft: number | null;
  amenities: string[] | null;
  approvals: string[] | null;
  rera_number: string | null;
  verification_status: string | null;
  availability: string | null;
};

export default defineTool({
  name: "get_listing",
  title: "Get listing details",
  description:
    "Get full details of one publicly visible PropWise listing by its id. The result says whether it is for sale, rent or lease.",
  inputSchema: { id: z.string().uuid().describe("Listing id from search_listings.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: p, error } = await sb
      .from("properties")
      .select("*")
      .eq("id", id).eq("status", "published").eq("listing_permission", true).eq("is_demo", false)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!p) throw new ToolError("Listing not found or not publicly available.");
    const row = p as unknown as ListingRow;
    const type = transactionTypeOf(row);
    const terms = termsOf(row, type);
    const listing = {
      id: row.id, title: row.title, description: row.description, location: row.location,
      address: row.address, property_type: row.property_type,
      transaction_type: type,
      // The unit travels with the figure, so a monthly amount is never read as a sale price.
      ...priceFields(type, row.asking_price),
      guideline_value: type === "buy" ? row.guideline_value : null,
      deposit: terms.deposit, maintenance_monthly: terms.maintenance_monthly, furnishing: terms.furnishing,
      available_from: terms.available_from, lease_months: terms.lease_months,
      escalation_pct: terms.escalation_pct, permitted_use: terms.permitted_use, renewal_terms: terms.renewal_terms,
      bedrooms: row.bedrooms, built_area_sqft: row.built_area_sqft, land_area_sqft: row.land_area_sqft,
      amenities: row.amenities ?? [],
      // Approvals and guideline value are a sale concept; they are not shown for a monthly listing.
      approvals: type === "buy" ? row.approvals ?? [] : [],
      rera_number: row.rera_number, verification_status: row.verification_status, availability: row.availability,
      note:
        type === "buy"
          ? "Estimates and details are unverified; not legal verification."
          : `This is a ${TRANSACTION_LABELS[type].toLowerCase()} listing. The figure is a monthly amount, not a purchase price, and stamp duty and registration do not apply. Null terms are unknown, not zero.`,
    };
    return { content: [{ type: "text", text: JSON.stringify(listing) }], structuredContent: { listing } };
  },
});
