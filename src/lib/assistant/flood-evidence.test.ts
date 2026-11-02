import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createAssistantTools } from "./tools";
import { findSkill } from "./skills";
import { SKILLS } from "./skill-files";
import { summariseArea } from "@/lib/area-intel";

type Row = Record<string, unknown>;

/** A minimal stand-in for the Supabase query builder: every chain resolves to the given rows. */
function fakeDb(rows: Record<string, Row[]>) {
  return {
    from: (table: string) => {
      const result = { data: rows[table] ?? [], error: null };
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "ilike"]) builder[m] = () => builder;
      builder["limit"] = () => Promise.resolve(result);
      builder["insert"] = () => Promise.resolve({ error: null });
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
}

async function evidenceFor(rows: Record<string, Row[]>, area: string) {
  const tools = createAssistantTools({ db: fakeDb(rows), userId: "u1", messageId: "m1" });
  const run = tools.get_locality_evidence.execute as (input: { area: string }, opts: unknown) => Promise<Record<string, unknown>>;
  return run({ area }, { toolCallId: "t1", messages: [] });
}

type Brief = { headline: string; facts: { key: string; evidence: string; value: string | null }[]; groundChecks: string[] };

describe("get_locality_evidence flood facts", () => {
  it("returns an evidence-labelled flood brief built from the published snapshot", async () => {
    const summary = summariseArea([{ type: "way", id: 1, center: { lat: 12.846, lon: 80.06 }, tags: { natural: "water", name: "Tank" } }], 12.845, 80.06, 39);
    const r = await evidenceFor({ area_intelligence: [{ city: "Chennai", area: "Guduvancheri", summary, sources: [], fetched_at: "2026-10-22" }] }, "Guduvancheri");
    const flood = r["flood"] as Brief;
    expect(flood.headline).toMatch(/not a flood-risk verdict/);
    const elevation = flood.facts.find((f) => f.key === "elevation");
    expect(elevation?.evidence).toBe("ESTIMATE");
    expect(elevation?.value).toBe("39 m");
    expect(flood.facts.find((f) => f.key === "waterlogging_history")?.evidence).toBe("UNKNOWN");
    expect(flood.groundChecks.length).toBeGreaterThan(0);
  });

  it("still returns an all-unknown flood brief and ground checks when we hold nothing", async () => {
    const r = await evidenceFor({}, "Nowhere");
    expect(r["unknown"]).toBe(true);
    const flood = r["flood"] as Brief;
    expect(flood.facts.every((f) => f.evidence === "UNKNOWN")).toBe(true);
    expect(flood.groundChecks.length).toBeGreaterThan(0);
  });
});

describe("flood-water-risk skill", () => {
  const skill = findSkill(SKILLS, "flood-water-risk");

  it("tells the assistant to use the flood field and keep its labels", () => {
    expect(skill).not.toBeNull();
    expect(skill!.body).toMatch(/`flood` field/);
    expect(skill!.body).toMatch(/evidence label/);
  });

  it("still forbids scores and flood-free reassurance", () => {
    expect(skill!.body).toMatch(/Never give a probability, a return period or a risk score/);
    expect(skill!.body).toMatch(/cannot tell anyone a property is flood-free/);
  });
});
