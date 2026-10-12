import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_listings",
  title: "Search public listings",
  description: "Search publicly visible PropWise property listings by location, type and maximum price.",
  inputSchema: {
    location: z.string().trim().optional().describe("Locality text to match, e.g. 'Velachery'."),
    property_type: z.string().trim().optional().describe("Property type, e.g. apartment, plot, house."),
    max_price: z.number().positive().optional().describe("Maximum asking price in rupees."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ location, property_type, max_price, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    // Same rule as public RLS, applied explicitly so admin callers never see drafts here.
    let q = sb
      .from("properties")
      .select("id,title,location,property_type,asking_price,bedrooms,built_area_sqft,land_area_sqft,verification_status")
      .eq("status", "published")
      .eq("listing_permission", true)
      .eq("is_demo", false)
      .limit(limit ?? 20);
    if (location) q = q.ilike("location", `%${location}%`);
    if (property_type) q = q.eq("property_type", property_type);
    if (max_price) q = q.lte("asking_price", max_price);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const listings = (data ?? []).map((p) => ({
      id: p.id, title: p.title, location: p.location, property_type: p.property_type,
      asking_price: p.asking_price, bedrooms: p.bedrooms, built_area_sqft: p.built_area_sqft,
      land_area_sqft: p.land_area_sqft, verification_status: p.verification_status,
    }));
    return {
      content: [{ type: "text", text: listings.length ? JSON.stringify(listings) : "No public listings match." }],
      structuredContent: { listings },
    };
  },
});
