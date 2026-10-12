import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchListings from "./tools/search-listings";
import getListing from "./tools/get-listing";
import myResearch from "./tools/my-research";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "emerald-property-hub",
  title: "Emerald Property Hub",
  version: "0.1.0",
  instructions:
    "PropWise AI property tools for Chennai and Tamil Nadu. Search and read publicly visible listings, and read the signed-in user's saved research. All figures are unverified estimates, not legal verification.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchListings, getListing, myResearch],
});
