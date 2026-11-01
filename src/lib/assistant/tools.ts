import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { TRANSACTION_LABELS, priceFields, termsOf, transactionTypeOf } from "@/lib/transaction";
import { buildLogRow, type SearchKind, type SearchSource } from "./search-log";
import { SKILLS } from "./skill-files";
import { findSkill } from "./skills";

type Db = SupabaseClient<Database>;

/**
 * assistant_search_log is created by migration 0012 and is not in the generated database types yet,
 * so it is reached through this narrow shape instead of a cast to any.
 */
type LooseDb = { from: (table: string) => { insert: (row: unknown) => PromiseLike<{ error: unknown }> } };

/**
 * The properties table reached with column names the generated types do not know yet.
 * transaction_type and the rent/lease terms are added by migration 0019, and the generated
 * types are owner-only to regenerate, so these two tools reach the table through this narrow
 * shape instead of a cast to any. Everything still runs as the signed-in user, so RLS applies.
 */
type LooseQuery = {
  eq: (column: string, value: unknown) => LooseQuery;
  ilike: (column: string, value: string) => LooseQuery;
  lte: (column: string, value: number) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => PromiseLike<LooseSingle>;
  then: <T>(resolve: (value: LooseResult) => T) => PromiseLike<T>;
};

type LooseResult = { data: Record<string, unknown>[] | null; error: { message: string } | null };
type LooseSingle = { data: Record<string, unknown> | null; error: { message: string } | null };
type LooseProps = { select: (columns: string) => LooseQuery };

type Ctx = { db: Db; userId: string; messageId: string };

/** The properties query builder, typed narrowly so the new transaction columns can be used. */
function propertiesTable(ctx: Ctx): LooseProps {
  return ctx.db.from("properties") as unknown as LooseProps;
}

/** Records one lookup. A logging failure must never break the answer, so it is only reported. */
async function record(ctx: Ctx, kind: SearchKind, input: unknown, resultCount: number, sources: SearchSource[]) {
  const row = buildLogRow({ userId: ctx.userId, messageId: ctx.messageId, kind, input, resultCount, sources });
  const { error } = await (ctx.db as unknown as LooseDb).from("assistant_search_log").insert(row);
  if (error) console.error("assistant: saving search log failed", error);
}

/**
 * Tools the help assistant can call. They run as the signed-in user, so row-level security applies,
 * and they re-apply the public-visibility rule so admin callers never see drafts through the chat.
 */
export function createAssistantTools(ctx: Ctx) {
  return {
    load_skill: tool({
      description:
        "Load a skill: a short playbook for one kind of question. Call it before answering when the question matches a skill's description in the system prompt. It reads no personal data and runs no lookup.",
      inputSchema: z.object({
        name: z.string().trim().min(1).max(60).describe("The skill name exactly as listed in the system prompt."),
      }),
      execute: async ({ name }) => {
        const skill = findSkill(SKILLS, name);
        if (!skill) return { error: "No skill with that name.", available: SKILLS.map((s) => s.name) };
        return { name: skill.name, instructions: skill.body };
      },
    }),
    search_listings: tool({
      description:
        "Search publicly visible PropWise property listings by locality, property type, transaction type and maximum price. A listing is either for sale, for rent (a monthly figure) or for lease (a monthly figure).",
      inputSchema: z.object({
        location: z.string().trim().max(100).optional().describe("Locality text, e.g. 'Velachery'."),
        property_type: z.string().trim().max(50).optional().describe("e.g. apartment, plot, house."),
        transaction_type: z
          .enum(["buy", "rent", "lease"])
          .optional()
          .describe("What the person wants: buy, rent or lease. Defaults to buy."),
        max_price: z
          .number()
          .positive()
          .optional()
          .describe("Maximum price in rupees. For rent or lease this is the monthly figure."),
        limit: z.number().int().min(1).max(10).optional().describe("Max results (default 5)."),
      }),
      execute: async (input) => {
        const type = input.transaction_type ?? "buy";
        let q = propertiesTable(ctx)
          .select("*")
          .eq("status", "published")
          .eq("listing_permission", true)
          .eq("is_demo", false)
          // A rent figure and a sale price are different units in the same column, so the
          // transaction is part of the query rather than something the reader has to notice.
          .eq("transaction_type", type)
          .limit(input.limit ?? 5);
        if (input.location) q = q.ilike("location", `%${input.location}%`);
        if (input.property_type) q = q.eq("property_type", input.property_type);
        if (input.max_price) q = q.lte("asking_price", input.max_price);
        const { data, error } = await q;
        if (error) {
          console.error("assistant: search_listings failed", error);
          return { error: "Listing search is unavailable right now." };
        }
        const listings = (data ?? []).map((row) => {
          const terms = termsOf(row, type);
          return {
            id: row["id"],
            title: row["title"],
            location: row["location"],
            property_type: row["property_type"],
            transaction_type: type,
            // The unit travels with the number, so a monthly figure is never reported as a price.
            ...priceFields(type, row["asking_price"]),
            deposit: terms.deposit,
            maintenance_monthly: terms.maintenance_monthly,
            furnishing: terms.furnishing,
            lease_months: terms.lease_months,
            escalation_pct: terms.escalation_pct,
            bedrooms: row["bedrooms"],
            built_area_sqft: row["built_area_sqft"],
            land_area_sqft: row["land_area_sqft"],
            verification_status: row["verification_status"],
          };
        });
        await record(
          ctx,
          "listings",
          input,
          listings.length,
          listings.flatMap((l) => (l.id ? [{ id: String(l.id), title: String(l.title) }] : [])),
        );
        return {
          listings,
          transaction_type: type,
          note:
            type === "buy"
              ? "Price is the seller's asking price in rupees: a claim, not a confirmed sale price. Deposit and lease fields are null for a sale."
              : `The figure is a monthly amount in rupees, not a purchase price. ${TRANSACTION_LABELS[type]} terms that are null are unknown, not zero.`,
        };
      },
    }),

    get_locality_evidence: tool({
      description:
        "Get published locality evidence for one Chennai area: the open-map snapshot and published infrastructure projects. Use it whenever someone asks what an area is like, what is planned nearby, or what we know about it. It returns only published rows; if there is nothing, the area is unknown to us.",
      inputSchema: z.object({
        area: z.string().trim().min(1).max(80).describe("Locality name, e.g. 'Tambaram'."),
      }),
      execute: async ({ area }) => {
        const [intel, infra] = await Promise.all([
          ctx.db
            .from("area_intelligence")
            .select("city,area,summary,sources,fetched_at")
            .eq("is_published", true)
            .ilike("area", area)
            .limit(1),
          ctx.db
            .from("infrastructure_projects")
            .select("name,location,description,progress_status,authority,source_url,verified,last_checked")
            .eq("is_published", true)
            .ilike("location", `%${area}%`)
            .limit(10),
        ]);
        if (intel.error || infra.error) {
          console.error("assistant: get_locality_evidence failed", intel.error ?? infra.error);
          return { error: "Locality evidence is unavailable right now." };
        }
        const snapshot = intel.data?.[0] ?? null;
        const projects = infra.data ?? [];
        await record(
          ctx,
          "locality",
          { area },
          (snapshot ? 1 : 0) + projects.length,
          projects.flatMap((p) => (p.source_url ? [{ title: p.name, url: p.source_url }] : [])),
        );
        if (!snapshot && projects.length === 0) {
          return {
            area,
            unknown: true,
            note: `We hold no published evidence for ${area}. Say it is unknown rather than describing the area from memory, and suggest the Localities page.`,
          };
        }
        return {
          area,
          snapshot,
          snapshotNote: snapshot
            ? "Area snapshot figures come from OpenStreetMap and Open-Meteo and are estimates, not a flood or legal check."
            : `No published snapshot for ${area}.`,
          infrastructureProjects: projects,
          note: "Projects carry their own source and last-checked date. Verified means we confirmed progress; unverified means we have not. Never predict price effects.",
        };
      },
    }),

    get_listing: tool({
      description:
        "Get the details of one publicly visible listing by its id (from search_listings). The result says whether it is for sale, rent or lease.",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const { data: p, error } = await propertiesTable(ctx)
          .select("*")
          .eq("id", id)
          .eq("status", "published")
          .eq("listing_permission", true)
          .eq("is_demo", false)
          .maybeSingle();
        if (error) {
          console.error("assistant: get_listing failed", error);
          return { error: "Listing lookup is unavailable right now." };
        }
        await record(ctx, "listing", { id }, p ? 1 : 0, p ? [{ id: String(p["id"]), title: String(p["title"]) }] : []);
        if (!p) return { error: "Listing not found or not publicly available." };
        const row = p;
        const type = transactionTypeOf(row);
        const terms = termsOf(row, type);
        return {
          listing: {
            id: row["id"],
            title: row["title"],
            description: row["description"],
            location: row["location"],
            property_type: row["property_type"],
            transaction_type: type,
            // Unit travels with the figure, so a monthly amount is never read as a sale price.
            ...priceFields(type, row["asking_price"]),
            guideline_value: type === "buy" ? row["guideline_value"] : null,
            deposit: terms.deposit,
            maintenance_monthly: terms.maintenance_monthly,
            furnishing: terms.furnishing,
            available_from: terms.available_from,
            lease_months: terms.lease_months,
            escalation_pct: terms.escalation_pct,
            permitted_use: terms.permitted_use,
            renewal_terms: terms.renewal_terms,
            bedrooms: row["bedrooms"],
            built_area_sqft: row["built_area_sqft"],
            land_area_sqft: row["land_area_sqft"],
            amenities: row["amenities"],
            approvals: type === "buy" ? row["approvals"] : null,
            rera_number: row["rera_number"],
            verification_status: row["verification_status"],
            availability: row["availability"],
          },
          note:
            type === "buy"
              ? "Details are claims by the seller, not legal verification. Guideline value and approvals apply to a sale only."
              : `This is a ${TRANSACTION_LABELS[type].toLowerCase()} listing. The figure is a monthly amount, not a purchase price, and stamp duty and registration do not apply. Null terms are unknown, not zero.`,
        };
      },
    }),
  };
}

/** Structural subset of a finished model step, so this file does not depend on SDK internals. */
type FinishedStep = {
  toolCalls?: ReadonlyArray<{ toolName: string; input?: unknown }>;
  sources?: ReadonlyArray<{ sourceType?: string; url?: string; title?: string }>;
};

/**
 * Web lookups run on the model provider's own licensed search tool, not on pages we fetch ourselves.
 * This records each one, with the links it cited, so the user can review them later.
 */
export async function recordWebSearches(ctx: Ctx, step: FinishedStep) {
  const calls = (step.toolCalls ?? []).filter((c) => c.toolName.includes("web_search"));
  if (!calls.length) return;
  const sources: SearchSource[] = [];
  for (const s of step.sources ?? []) {
    if (s.sourceType !== "url" || !s.url) continue;
    sources.push(s.title ? { url: s.url, title: s.title } : { url: s.url });
  }
  for (const call of calls) {
    await record(ctx, "web", call.input, sources.length, sources);
  }
}

/** Web search is off unless the owner turns it on, because it spends extra credits and is untested on the gateway. */
export function webSearchEnabled(): boolean {
  return process.env["ASSISTANT_WEB_SEARCH"] === "on";
}
