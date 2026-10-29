import { AREAS } from "./areas";
import { AVAILABILITY, APPROVALS, PROPERTY_TYPES } from "./constants";
import { parseLocationInput, validLatLng } from "./mapurl";
import { parseCsv } from "./research/core";

/** Turns a broker/owner CSV into DRAFT listings. Rows without owner consent, a source or a map location are rejected, never guessed. */

export const TEMPLATE_COLUMNS = [
  "title", "property_type", "area", "address", "asking_price", "bedrooms", "built_area_sqft", "land_area_sqft",
  "availability", "survey_number", "approvals", "rera_number", "google_maps_link", "latitude", "longitude",
  "source", "owner_consent", "consent_note", "description",
] as const;

export type ListingDraft = {
  title: string; property_type: string; location: string; address: string | null; asking_price: number;
  bedrooms: number | null; built_area_sqft: number | null; land_area_sqft: number | null; availability: string;
  survey_number: string | null; approvals: string[]; rera_number: string | null; latitude: number; longitude: number;
  source: string; listing_permission: true; permission_evidence: string; description: string | null;
  status: "draft"; verification_status: "unverified"; is_demo: false;
};
export type RowError = { row: number; title: string; problems: string[] };
export type ImportResult = { drafts: ListingDraft[]; errors: RowError[]; skippedExamples: number };

const YES = new Set(["yes", "y", "true", "1"]);
const AREA_NAMES = Object.keys(AREAS["Chennai"]!);
const TYPE_VALUES: string[] = PROPERTY_TYPES.map((t) => t.value);

const clean = (v: string | undefined) => (v ?? "").trim();
function num(v: string | undefined): number | null {
  const s = clean(v).replace(/[,₹\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

function typeOf(v: string): string | null {
  const s = v.toLowerCase().replace(/[\s-]+/g, "_");
  if (TYPE_VALUES.includes(s)) return s;
  if (s.includes("flat") || s.includes("apartment")) return "apartment";
  if (s.includes("plot") || s.includes("land")) return "plot";
  if (s.includes("villa")) return "villa";
  if (s.includes("house")) return "independent_house";
  return null;
}

export function listingKey(l: { title: string; location: string; asking_price: number }) {
  return `${l.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${l.location.toLowerCase()}|${l.asking_price}`;
}

export function parseListingCsv(text: string, existingKeys: Set<string> = new Set()): ImportResult {
  const rows = parseCsv(text.replace(/^﻿/, ""));
  const drafts: ListingDraft[] = [];
  const errors: RowError[] = [];
  const seen = new Set(existingKeys);
  let skippedExamples = 0;

  rows.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    const title = clean(r["title"]);
    if (/^example\b/i.test(title)) { skippedExamples++; return; }
    const problems: string[] = [];

    if (!title) problems.push("title is missing");
    const type = typeOf(clean(r["property_type"]));
    if (!type) problems.push(`property_type must be one of: ${TYPE_VALUES.join(", ")}`);
    const area = AREA_NAMES.find((a) => a.toLowerCase() === clean(r["area"]).toLowerCase());
    if (!area) problems.push("area must match a name from the Areas sheet");
    const price = num(r["asking_price"]);
    if (price == null || Number.isNaN(price) || price < 100000) problems.push("asking_price must be a number of at least 1,00,000");

    let point = validLatLng(clean(r["latitude"]), clean(r["longitude"]));
    if (!point && clean(r["google_maps_link"])) {
      const p = parseLocationInput(clean(r["google_maps_link"]));
      point = p.ok ? p.point : null;
    }
    if (!point) problems.push("a map location is needed: fill google_maps_link, or latitude and longitude");

    if (!YES.has(clean(r["owner_consent"]).toLowerCase())) problems.push("owner_consent must be yes: the owner must agree to the listing");
    const consentNote = clean(r["consent_note"]);
    if (!consentNote) problems.push("consent_note is required (for example: owner agreed on WhatsApp, 12 Oct)");
    const source = clean(r["source"]);
    if (!source) problems.push("source is required (who supplied this listing)");

    const beds = num(r["bedrooms"]), built = num(r["built_area_sqft"]), land = num(r["land_area_sqft"]);
    for (const [name, v] of [["bedrooms", beds], ["built_area_sqft", built], ["land_area_sqft", land]] as const) if (Number.isNaN(v)) problems.push(`${name} must be a number`);

    const availRaw = clean(r["availability"]).toLowerCase().replace(/[\s-]+/g, "_");
    // Object.hasOwn, not `in`: `in` walks the prototype chain, so words like
    // "constructor" or "toString" would pass validation and reach the database.
    const availability = availRaw ? (Object.hasOwn(AVAILABILITY, availRaw) ? availRaw : null) : "ready";
    if (!availability) problems.push(`availability must be one of: ${Object.keys(AVAILABILITY).join(", ")}`);

    const approvals = clean(r["approvals"]).split(/[;,|]/).map((a) => a.trim()).filter(Boolean)
      .map((a) => APPROVALS.find((x) => x.toLowerCase() === a.toLowerCase()) ?? a);
    const badApproval = approvals.find((a) => !(APPROVALS as readonly string[]).includes(a));
    if (badApproval) problems.push(`approvals: "${badApproval}" is not one of ${APPROVALS.join(", ")}`);

    if (problems.length) { errors.push({ row: rowNo, title: title || "(no title)", problems }); return; }

    const draft: ListingDraft = {
      title, property_type: type!, location: area!, address: clean(r["address"]) || null, asking_price: price!,
      bedrooms: beds == null ? null : Math.round(beds), built_area_sqft: built, land_area_sqft: land, availability: availability!,
      survey_number: clean(r["survey_number"]) || null, approvals, rera_number: clean(r["rera_number"]) || null,
      latitude: point!.lat, longitude: point!.lng, source, listing_permission: true, permission_evidence: consentNote,
      description: clean(r["description"]) || null, status: "draft", verification_status: "unverified", is_demo: false,
    };
    const key = listingKey(draft);
    if (seen.has(key)) { errors.push({ row: rowNo, title, problems: ["duplicate of a listing already in the file or the admin"] }); return; }
    seen.add(key);
    drafts.push(draft);
  });
  return { drafts, errors, skippedExamples };
}

export function templateCsv(): string {
  const q = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const example: Record<string, string> = {
    title: "EXAMPLE - 2BHK flat near Tambaram station (delete this row)", property_type: "apartment", area: "Tambaram", address: "Near Tambaram railway station",
    asking_price: "5500000", bedrooms: "2", built_area_sqft: "950", land_area_sqft: "", availability: "ready", survey_number: "", approvals: "DTCP",
    rera_number: "", google_maps_link: "https://www.google.com/maps/@12.9249,80.1000,17z", latitude: "", longitude: "", source: "Broker: your name",
    owner_consent: "yes", consent_note: "Owner agreed on WhatsApp, 12 Oct", description: "",
  };
  return [TEMPLATE_COLUMNS.join(","), TEMPLATE_COLUMNS.map((c) => q(example[c] ?? "")).join(",")].join("\n") + "\n";
}

export const AREA_LIST = AREA_NAMES;
