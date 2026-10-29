import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { priceFields, termsOf, type TransactionFields } from "@/lib/transaction";
import { supabaseForUser } from "../supabase";

/**
 * The columns this tool returns, typed structurally rather than through the generated database
 * types. transaction_type and the rent and lease terms come from migration 0019, which the
 * generated types do not know about yet, and those types are owner-only to regenerate.
 */
type ListingRow = TransactionFields & {
  id: string;
  title: string;
  location: string;
  property_type: string;
  asking_price: number | null;
  bedrooms: number | null;
  built_area_sqft: number | null;
  land_area_sqft: number | null;
  verification_status: string | null;
};

export default defineTool({
  name: "search_listings",
  title: "Search public listings",
  description:
    "Search publicly visible PropWise property listings by location, type, transaction type and maximum price. A listing is for sale, for rent or for lease.",
  inputSchema: {
    location: z.string().trim().optional().describe("Locality text to match, e.g. 'Velachery'."),
    property_type: z.string().trim().optional().describe("Property type, e.g. apartment, plot, house."),
    transaction_type: z
      .enum(["buy", "rent", "lease"])
      .optional()
      .describe("What the caller wants: buy, rent or lease. Defaults to buy."),
    max_price: z
      .number()
      .positive()
      .optional()
      .describe("Maximum price in rupees. For rent or lease this is the monthly figure."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ location, property_type, transaction_type, max_price, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    const type = transaction_type ?? "buy";
    // Same rule as public RLS, applied explicitly so admin callers never see drafts here.
    // The transaction filter keeps a monthly rent out of a list of sale prices: both live in
    // the same column, and the unit is not visible from the number alone.
    let q = sb
      .from("properties")
      .select("*")
      .eq("status", "published")
      .eq("listing_permission", true)
      .eq("is_demo", false)
      .eq("transaction_type", type)
      .limit(limit ?? 20);
    if (location) q = q.ilike("location", `%${location}%`);
    if (property_type) q = q.eq("property_type", property_type);
    if (max_price) q = q.lte("asking_price", max_price);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const listings = ((data ?? []) as unknown as ListingRow[]).map((row) => {
      const terms = termsOf(row, type);
      return {
        id: row.id,
        title: row.title,
        location: row.location,
        property_type: row.property_type,
        transaction_type: type,
        // The unit travels with the figure, so a monthly amount is never read as a price.
        ...priceFields(type, row.asking_price),
        deposit: terms.deposit,
        maintenance_monthly: terms.maintenance_monthly,
        furnishing: terms.furnishing,
        lease_months: terms.lease_months,
        escalation_pct: terms.escalation_pct,
        bedrooms: row.bedrooms,
        built_area_sqft: row.built_area_sqft,
        land_area_sqft: row.land_area_sqft,
        verification_status: row.verification_status,
      };
    });
    return {
      content: [{ type: "text", text: listings.length ? JSON.stringify(listings) : "No public listings match." }],
      structuredContent: { listings, transaction_type: type },
    };
  },
});
