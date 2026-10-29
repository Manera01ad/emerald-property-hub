import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildLogRow, type SearchKind, type SearchSource } from "./search-log";

type Db = SupabaseClient<Database>;

/**
 * assistant_search_log is created by migration 0012 and is not in the generated database types yet,
 * so it is reached through this narrow shape instead of a cast to any.
 */
type LooseDb = { from: (table: string) => { insert: (row: unknown) => PromiseLike<{ error: unknown }> } };

type Ctx = { db: Db; userId: string; messageId: string };

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
    search_listings: tool({
      description: "Search publicly visible PropWise property listings by locality, property type and maximum price.",
      inputSchema: z.object({
        location: z.string().trim().max(100).optional().describe("Locality text, e.g. 'Velachery'."),
        property_type: z.string().trim().max(50).optional().describe("e.g. apartment, plot, house."),
        max_price: z.number().positive().optional().describe("Maximum asking price in rupees."),
        limit: z.number().int().min(1).max(10).optional().describe("Max results (default 5)."),
      }),
      execute: async (input) => {
        let q = ctx.db
          .from("properties")
          .select("id,title,location,property_type,asking_price,bedrooms,built_area_sqft,land_area_sqft,verification_status")
          .eq("status", "published")
          .eq("listing_permission", true)
          .eq("is_demo", false)
          .limit(input.limit ?? 5);
        if (input.location) q = q.ilike("location", `%${input.location}%`);
        if (input.property_type) q = q.eq("property_type", input.property_type);
        if (input.max_price) q = q.lte("asking_price", input.max_price);
        const { data, error } = await q;
        if (error) {
          console.error("assistant: search_listings failed", error);
          return { error: "Listing search is unavailable right now." };
        }
        const listings = data ?? [];
        await record(ctx, "listings", input, listings.length, listings.map((l) => ({ id: l.id, title: l.title })));
        return { listings, note: "Figures are unverified estimates, not legal verification." };
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
      description: "Get the details of one publicly visible listing by its id (from search_listings).",
      inputSchema: z.object({ id: z.string().uuid() }),
      execute: async ({ id }) => {
        const { data: p, error } = await ctx.db
          .from("properties")
          .select("id,title,description,location,property_type,asking_price,guideline_value,bedrooms,built_area_sqft,land_area_sqft,amenities,approvals,rera_number,verification_status,availability")
          .eq("id", id)
          .eq("status", "published")
          .eq("listing_permission", true)
          .eq("is_demo", false)
          .maybeSingle();
        if (error) {
          console.error("assistant: get_listing failed", error);
          return { error: "Listing lookup is unavailable right now." };
        }
        await record(ctx, "listing", { id }, p ? 1 : 0, p ? [{ id: p.id, title: p.title }] : []);
        if (!p) return { error: "Listing not found or not publicly available." };
        return { listing: p, note: "Details are unverified; not legal verification." };
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
