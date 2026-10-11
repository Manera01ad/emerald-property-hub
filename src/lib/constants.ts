export const MARKETS = [
  "Guduvancheri",
  "Potheri",
  "Maraimalai Nagar",
  "Avadi",
  "Pattabiram",
  "Poonamallee",
  "Thiruverkkadu",
  "Tambaram",
] as const;

export const PROPERTY_TYPES = [
  { value: "villa", label: "Villa" },
  { value: "independent_house", label: "Independent house" },
  { value: "resale_home", label: "Resale home" },
  { value: "apartment", label: "Apartment" },
  { value: "plot", label: "Plot" },
] as const;

export const APPROVALS = ["DTCP", "CMDA", "RERA", "Panchayat", "Corporation"] as const;

export const AVAILABILITY: Record<string, string> = {
  ready: "Ready to move",
  under_construction: "Under construction",
  sold: "Sold",
};

export const VERIFICATION: Record<string, string> = {
  unverified: "Unverified",
  partially_verified: "Partially verified",
  verified: "Verified",
};

export const PLACE_CATEGORIES: Record<string, string> = {
  cbse_school: "CBSE schools",
  hospital: "Hospitals",
  transport: "Transport",
  employment: "Employment hubs",
};

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "visit_scheduled",
  "visited",
  "negotiation",
  "won",
  "lost",
] as const;

export const DOCS = [
  { key: "doc_title_deed", label: "Title deed / parent documents" },
  { key: "doc_encumbrance", label: "Encumbrance certificate (EC)" },
  { key: "doc_patta", label: "Patta / Chitta" },
  { key: "doc_approved_plan", label: "Approved layout / building plan" },
  { key: "doc_building_permit", label: "Building permit / completion certificate" },
] as const;

export const typeLabel = (v: string) => PROPERTY_TYPES.find((t) => t.value === v)?.label ?? v;
export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const MAX_COMPARE = 4;
