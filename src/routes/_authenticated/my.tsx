import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import { useIsAdmin, useSession } from "@/lib/auth";
import { costRulesFrom, publicPropertiesQuery, useSettings } from "@/lib/data";
import { MARKETS, PROPERTY_TYPES } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { buyAnalysis, rentAnalysis, rentVsBuy, matchProperty, DUE_DILIGENCE_QUESTIONS } from "@/lib/buyer";

export const Route = createFileRoute("/_authenticated/my")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "My Property Research — PropWise AI" },
      { name: "description", content: "Your buyer or renter preferences, cost calculators, matches and saved decision reports." },
      { property: "og:title", content: "My Property Research — PropWise AI" },
      { property: "og:description", content: "Preferences, buy and rent analysis, and decision reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MyPage,
});

type Profile = {
  intent: string; property_types: string[]; budget: number | null; monthly_rent_budget: number | null;
  preferred_locations: string[]; bedrooms: number | null; min_area_sqft: number | null;
  school_preference: string; commute_destinations: string; lifestyle_priorities: string;
  financing: string; move_in_timeframe: string;
};
const empty: Profile = { intent: "buy", property_types: [], budget: null, monthly_rent_budget: null, preferred_locations: [], bedrooms: null, min_area_sqft: null, school_preference: "", commute_destinations: "", lifestyle_priorities: "", financing: "", move_in_timeframe: "" };
const n = (v: string) => (v === "" ? null : Number(v));
const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function MyPage() {
  const { session } = useSession();
  const uid = session?.user.id;
  const { data: isAdmin } = useIsAdmin(uid);
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const rules = costRulesFrom(settings);
  const profileQ = useQuery({
    queryKey: ["buyer-profile", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("buyer_profiles").select("*").eq("user_id", uid!).maybeSingle()).data,
  });
  const reportsQ = useQuery({
    queryKey: ["buyer-reports", uid], enabled: !!uid,
    queryFn: async () => (await supabase.from("buyer_reports").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: props } = useQuery(publicPropertiesQuery);
  const [f, setF] = useState<Profile>(empty);
  useEffect(() => {
    const p = profileQ.data;
    if (p) setF({ ...empty, ...p, school_preference: p.school_preference ?? "", financing: p.financing ?? "", move_in_timeframe: p.move_in_timeframe ?? "",
      commute_destinations: p.commute_destinations.join(", "), lifestyle_priorities: p.lifestyle_priorities.join(", "),
      budget: p.budget, monthly_rent_budget: p.monthly_rent_budget, min_area_sqft: p.min_area_sqft });
  }, [profileQ.data]);

  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  async function saveProfile() {
    const { error } = await supabase.from("buyer_profiles").upsert({
      user_id: uid!, intent: f.intent, property_types: f.property_types, budget: f.budget, monthly_rent_budget: f.monthly_rent_budget,
      preferred_locations: f.preferred_locations, bedrooms: f.bedrooms, min_area_sqft: f.min_area_sqft,
      school_preference: f.school_preference || null, commute_destinations: list(f.commute_destinations),
      lifestyle_priorities: list(f.lifestyle_priorities), financing: f.financing || null, move_in_timeframe: f.move_in_timeframe || null,
    }, { onConflict: "user_id" });
    if (error) { toast.error(error.message); return; }
    toast.success("Preferences saved");
    qc.invalidateQueries({ queryKey: ["buyer-profile"] });
  }
  async function deleteProfile() {
    if (!confirm("Delete your saved preferences?")) return;
    const { error } = await supabase.from("buyer_profiles").delete().eq("user_id", uid!);
    if (error) { toast.error(error.message); return; }
    setF(empty); toast.success("Preferences deleted");
    qc.invalidateQueries({ queryKey: ["buyer-profile"] });
  }
  const toggle = (k: "property_types" | "preferred_locations", v: string) =>
    setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  // Calculators
  const [b, setB] = useState({ price: 5_000_000, otherCosts: 0, downPayment: 1_000_000, ratePct: 8.5, years: 20 });
  const [r, setR] = useState({ rent: 20000, deposit: 200000, brokerage: 0, maintenance: 2000, moving: 10000, renewalIncreasePct: 5 });
  const [horizon, setHorizon] = useState(5);
  const buy = buyAnalysis({ ...b, ...(f.budget != null ? { budget: f.budget } : {}) }, rules);
  const rent = rentAnalysis(r);
  const rvb = rentVsBuy(buy, r, horizon);

  const matches = useMemo(() => (props ?? []).map((p) => ({ p, m: matchProperty(p, f, rules) })).sort((a, z) => (z.m.overall ?? -1) - (a.m.overall ?? -1)), [props, f, rules]);

  async function saveReport(kind: "buy" | "rent" | "rent_vs_buy") {
    const result = {
      generated_at: new Date().toISOString(),
      requirements: f,
      observed_facts: matches.slice(0, 5).map(({ p }) => ({ id: p.id, title: p.title, location: p.location, asking_price: p.asking_price, verification_status: p.verification_status, source: p.source, listed_on_propwise: p.created_at })),
      calculations: kind === "rent" ? rent : kind === "buy" ? buy : { buy, rent, rvb },
      assumptions: { stamp_duty_pct: rules.stampDutyPct, registration_pct: rules.registrationPct, legal_fee: rules.legalFee, rates_status: "Unverified placeholders until confirmed with Tamil Nadu registration department", no_appreciation_or_returns_assumed: true },
      interpretation: matches.slice(0, 5).map(({ p, m }) => ({ title: p.title, match_score: m.overall, parts: m.parts, concerns: m.concerns, missing: m.missing })),
      inventory_note: matches.length === 0 ? "No published, permission-backed listings are available yet; this report covers costs only." : null,
      due_diligence_questions: DUE_DILIGENCE_QUESTIONS,
    };
    const title = `${kind === "buy" ? "Purchase" : kind === "rent" ? "Rental" : "Rent vs buy"} analysis — ${new Date().toLocaleDateString("en-IN")}`;
    const { error } = await supabase.from("buyer_reports").insert({ user_id: uid!, kind, title, inputs: { b, r, horizon } as unknown as Json, result: result as unknown as Json });
    if (error) { toast.error(error.message); return; }
    toast.success("Report saved to your account");
    qc.invalidateQueries({ queryKey: ["buyer-reports"] });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-2"><h1 className="text-4xl">My property research</h1>{isAdmin && <Button asChild variant="outline" size="sm"><Link to="/admin">Admin dashboard</Link></Button>}</div>
      <p className="mt-2 text-muted-foreground">Estimates only. Tamil Nadu duty rates shown here are unconfirmed placeholders. Nothing here is legal verification.</p>
      <Tabs defaultValue="profile" className="mt-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="profile">Preferences</TabsTrigger>
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="rent">Rent</TabsTrigger>
          <TabsTrigger value="rvb">Rent vs buy</TabsTrigger>
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4 rounded-xl border bg-card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>I want to</Label>
              <select className={sel} value={f.intent} onChange={(e) => setF({ ...f, intent: e.target.value })}><option value="buy">Buy</option><option value="rent">Rent</option></select></div>
            {f.intent === "buy"
              ? <div className="space-y-1.5"><Label>Total budget (₹)</Label><Input type="number" value={f.budget ?? ""} onChange={(e) => setF({ ...f, budget: n(e.target.value) })} /></div>
              : <div className="space-y-1.5"><Label>Monthly rent budget (₹)</Label><Input type="number" value={f.monthly_rent_budget ?? ""} onChange={(e) => setF({ ...f, monthly_rent_budget: n(e.target.value) })} /></div>}
            <div className="space-y-1.5"><Label>Min bedrooms</Label><Input type="number" min={0} value={f.bedrooms ?? ""} onChange={(e) => setF({ ...f, bedrooms: n(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>Min area (sq ft)</Label><Input type="number" min={0} value={f.min_area_sqft ?? ""} onChange={(e) => setF({ ...f, min_area_sqft: n(e.target.value) })} /></div>
            <div className="space-y-1.5"><Label>School preference</Label><Input placeholder="e.g. CBSE within 3 km" value={f.school_preference} onChange={(e) => setF({ ...f, school_preference: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Commute destinations (comma separated)</Label><Input value={f.commute_destinations} onChange={(e) => setF({ ...f, commute_destinations: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Lifestyle priorities (comma separated)</Label><Input value={f.lifestyle_priorities} onChange={(e) => setF({ ...f, lifestyle_priorities: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Financing</Label><Input placeholder="Home loan / self-funded" value={f.financing} onChange={(e) => setF({ ...f, financing: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Move-in timeframe</Label><Input placeholder="e.g. within 6 months" value={f.move_in_timeframe} onChange={(e) => setF({ ...f, move_in_timeframe: e.target.value })} /></div>
          </div>
          <div><Label>Property types</Label><div className="mt-2 flex flex-wrap gap-2">{PROPERTY_TYPES.map((t) => (
            <Button key={t.value} size="sm" type="button" variant={f.property_types.includes(t.value) ? "default" : "outline"} onClick={() => toggle("property_types", t.value)}>{t.label}</Button>))}</div></div>
          <div><Label>Preferred locations</Label><div className="mt-2 flex flex-wrap gap-2">{MARKETS.map((m) => (
            <Button key={m} size="sm" type="button" variant={f.preferred_locations.includes(m) ? "default" : "outline"} onClick={() => toggle("preferred_locations", m)}>{m}</Button>))}</div></div>
          <div className="flex gap-2"><Button onClick={saveProfile}>Save preferences</Button>{profileQ.data && <Button variant="outline" onClick={deleteProfile}>Delete preferences</Button>}</div>
        </TabsContent>

        <TabsContent value="buy" className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-2">
          <div className="space-y-3">
            {([["price", "Asking price (₹)"], ["otherCosts", "Other expenses you expect (₹)"], ["downPayment", "Down payment (₹)"], ["ratePct", "Loan interest (% per year)"], ["years", "Loan term (years)"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1.5"><Label>{l}</Label><Input type="number" value={b[k]} onChange={(e) => setB({ ...b, [k]: Number(e.target.value) })} /></div>))}
          </div>
          <Rows rows={[["Stamp duty (est., unverified rate)", buy.stampDuty], ["Registration (est., unverified rate)", buy.registration], ["Legal fee (placeholder)", buy.legal], ["Other expenses", buy.otherCosts], ["Total estimated cost", buy.total], ["Loan amount", buy.loan], ["Monthly EMI", buy.emi], ["Total interest over term", buy.totalInterest], ["Cash needed upfront", buy.upfrontCash], ...(buy.budgetDiff != null ? [["Left in budget (negative = over)", buy.budgetDiff] as [string, number]] : [])]}
            action={<Button onClick={() => saveReport("buy")}>Save as report</Button>} />
        </TabsContent>

        <TabsContent value="rent" className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-2">
          <div className="space-y-3">
            {([["rent", "Monthly rent (₹)"], ["deposit", "Refundable deposit (₹)"], ["brokerage", "Brokerage, if any (₹)"], ["maintenance", "Monthly maintenance (₹)"], ["moving", "Moving costs (₹)"], ["renewalIncreasePct", "Expected renewal increase (%)"]] as const).map(([k, l]) => (
              <div key={k} className="space-y-1.5"><Label>{l}</Label><Input type="number" value={r[k]} onChange={(e) => setR({ ...r, [k]: Number(e.target.value) })} /></div>))}
          </div>
          <Rows rows={[["First-year cash outflow (excl. deposit)", rent.firstYearOutflow], ["Refundable deposit", rent.refundableDeposit], ["Cash needed to move in", rent.cashNeededUpfront], ["Rent after first renewal", rent.secondYearMonthlyRent]]}
            action={<Button onClick={() => saveReport("rent")}>Save as report</Button>} />
        </TabsContent>

        <TabsContent value="rvb" className="space-y-4 rounded-xl border bg-card p-5">
          <div className="max-w-xs space-y-1.5"><Label>Compare over (years)</Label><Input type="number" min={1} max={30} value={horizon} onChange={(e) => setHorizon(Math.max(1, Number(e.target.value)))} /></div>
          <Rows rows={[["Cash paid buying (upfront + EMIs)", rvb.buyPaid], ["Cash paid renting (rent + maintenance + fees)", rvb.rentPaid], ["Buying costs more by (negative = less)", rvb.difference]]}
            action={<Button onClick={() => saveReport("rent_vs_buy")}>Save as report</Button>} />
          <p className="text-xs text-muted-foreground">Assumptions: uses the figures from the Buy and Rent tabs; no property appreciation, rental yield or investment returns are assumed; the deposit is treated as refunded. Buying also builds ownership value that this cash comparison does not count.</p>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          {matches.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-muted-foreground">No published listings with owner permission are available yet, so there's nothing to rank. Your cost calculations and reports still work, and matches will appear as real listings are added.</div>
          ) : matches.map(({ p, m }) => (
            <div key={p.id} className="rounded-xl border bg-card p-5">
              <div className="flex justify-between gap-2"><p className="font-display text-lg">{p.title}</p><p className="font-display text-2xl text-primary">{m.overall ?? "—"}</p></div>
              <ul className="mt-2 text-sm text-muted-foreground">{m.parts.map((x) => <li key={x.label}>{x.label}: {x.score ?? "n/a"} — {x.note}</li>)}</ul>
              {m.concerns.length > 0 && <p className="mt-2 text-sm text-destructive">{m.concerns.join(" ")}</p>}
              {m.missing.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Missing: {m.missing.join(", ")}</p>}
            </div>))}
        </TabsContent>

        <TabsContent value="reports" className="space-y-3">
          {(reportsQ.data ?? []).length === 0 && <p className="text-muted-foreground">No reports yet. Save one from the Buy, Rent or Rent vs buy tab.</p>}
          {(reportsQ.data ?? []).map((rep) => (
            <div key={rep.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
              <div><p className="font-medium">{rep.title}</p><p className="text-xs text-muted-foreground">{new Date(rep.created_at).toLocaleString("en-IN")}</p></div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => download(rep.title, rep.result)}>Download</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("buyer_reports").delete().eq("id", rep.id); qc.invalidateQueries({ queryKey: ["buyer-reports"] }); }}>Delete</Button>
              </div>
            </div>))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Rows({ rows, action }: { rows: [string, number][]; action: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {rows.map(([l, v]) => <div key={l} className="flex justify-between border-b py-1.5 text-sm"><span>{l}</span><span className="font-medium">{formatINR(v)}</span></div>)}
      <div className="pt-2">{action}</div>
    </div>
  );
}

function esc(s: unknown) { return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!); }
function section(title: string, v: unknown) { return `<h2>${esc(title)}</h2><pre>${esc(JSON.stringify(v, null, 2))}</pre>`; }
function download(title: string, result: Json) {
  const r = (result ?? {}) as { requirements?: unknown; observed_facts?: unknown; calculations?: unknown; assumptions?: unknown; interpretation?: unknown; inventory_note?: string; due_diligence_questions?: string[] };
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto}pre{white-space:pre-wrap;background:#f4f4f4;padding:1rem}</style>
<h1>${esc(title)}</h1><p><b>PropWise AI buyer decision report.</b> Estimates only — not legal verification, a title certificate or an approval certification.</p>
${section("Your requirements", r.requirements)}${section("Observed facts (from listings)", r.observed_facts)}${section("Calculations", r.calculations)}${section("Assumptions", r.assumptions)}${section("AI interpretation", r.interpretation)}${r.inventory_note ? `<p><i>${esc(r.inventory_note)}</i></p>` : ""}
<h2>Questions to ask before paying any advance</h2><ul>${((r.due_diligence_questions as string[]) ?? []).map((q) => `<li>${esc(q)}</li>`).join("")}</ul>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `${title.replace(/[^\w]+/g, "-")}.html`;
  a.click();
}
