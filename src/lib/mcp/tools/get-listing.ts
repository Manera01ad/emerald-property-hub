import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_listing",
  title: "Get listing details",
  description: "Get full details of one publicly visible PropWise listing by its id.",
  inputSchema: { id: z.string().uuid().describe("Listing id from search_listings.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data: p, error } = await sb
      .from("properties")
      .select("id,title,description,location,address,property_type,asking_price,guideline_value,bedrooms,built_area_sqft,land_area_sqft,amenities,approvals,rera_number,verification_status,availability")
      .eq("id", id).eq("status", "published").eq("listing_permission", true).eq("is_demo", false)
      .maybeSingle();
    if (error) throw new ToolError(error.message);
    if (!p) throw new ToolError("Listing not found or not publicly available.");
    const listing = {
      id: p.id, title: p.title, description: p.description, location: p.location, address: p.address,
      property_type: p.property_type, asking_price: p.asking_price, guideline_value: p.guideline_value,
      bedrooms: p.bedrooms, built_area_sqft: p.built_area_sqft, land_area_sqft: p.land_area_sqft,
      amenities: p.amenities ?? [], approvals: p.approvals ?? [], rera_number: p.rera_number,
      verification_status: p.verification_status, availability: p.availability,
      note: "Estimates and details are unverified; not legal verification.",
    };
    return { content: [{ type: "text", text: JSON.stringify(listing) }], structuredContent: { listing } };
  },
});
