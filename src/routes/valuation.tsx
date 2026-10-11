import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { valueProperty, type Evidence, type Kind } from "@/lib/valuation";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/valuation")({
  head: () => ({
    meta: [
      { title: "Property value estimator — PropWise AI" },
      { name: "description", content: "Estimate a value range for plots, houses, apartments and rentals in Chennai from your own comparable evidence." },
      { property: "og:title", content: "Property value estimator — PropWise AI" },
      { property: "og:description", content: "Transparent value ranges with assumptions and confidence. Not a guaranteed price." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValuationPage,
});

const KINDS: { v: Kind; l: string }[] = [
  { v: "plot", l: "Plot / land" }, { v: "independent_house", l: "Independent house" },
  { v: "apartment", l: "Apartment" }, { v: "rental", l: "Rental (monthly rent)" },
];

function ValuationPage() {
  const [kind, setKind] = useState<Kind>("plot");
  const [area, setArea] = useState("");
  const [land, setLand] = useState("");
  const [gv, setGv] = useState("");
  const [age, setAge] = useState("");
  const [build, setBuild] = useState("");
  const [comps, setComps] = useState<{ price: string; area: string; kind: Evidence["kind"] }[]>([{ price: "", area: "", kind: "asking" }]);
  const num = (s: string) => (s ? Number(s) : null);
  const v = valueProperty({
    kind, area_sqft: Number(area) || 0, land_area_sqft: num(land), guideline_value_per_sqft: num(gv),
    building_age_years: num(age), construction_rate_per_sqft: num(build),
    comparables: comps.map((c) => ({ price: Number(c.price) || 0, area_sqft: Number(c.area) || 0, kind: c.kind })),
  });
  const isHouse = kind === "independent_house";
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl">Property value estimator</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Enter real comparable prices you have found. We show a range, the method and how confident the estimate is. This is not a guaranteed sale value or a legal valuation.</p>
      <div className="gold-rule my-6" />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4">
          <label className="block text-sm font-medium">Property type
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="mt-1 h-10 w-full rounded-md border bg-background px-3">
              {KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
            </select>
          </label>
          <Field label={kind === "plot" ? "Plot area (sq ft)" : "Built-up area (sq ft)"} value={area} set={setArea} />
          {kind !== "rental" && <Field label="Guideline value (₹ per sq ft, optional)" value={gv} set={setGv} />}
          {isHouse && <>
            <Field label="Land area (sq ft)" value={land} set={setLand} />
            <Field label="Building age (years)" value={age} set={setAge} />
            <Field label="Construction cost today (₹ per sq ft)" value={build} set={setBuild} />
          </>}
          <div>
            <p className="text-sm font-medium">Comparables ({kind === "rental" ? "monthly rent" : "price"} and area)</p>
            {comps.map((c, i) => (
              <div key={i} className="mt-2 flex gap-2">
                <Input placeholder={kind === "rental" ? "Rent ₹" : "Price ₹"} inputMode="numeric" value={c.price} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} />
                <Input placeholder="Sq ft" inputMode="numeric" value={c.area} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, area: e.target.value } : x))} />
                <select value={c.kind} onChange={(e) => setComps(comps.map((x, j) => j === i ? { ...x, kind: e.target.value as Evidence["kind"] } : x))} className="h-10 rounded-md border bg-background px-2 text-sm">
                  <option value="asking">Asking</option><option value="transaction">Registered sale</option>
                </select>
              </div>
            ))}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setComps([...comps, { price: "", area: "", kind: "asking" }])}>Add comparable</Button>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <p className="text-sm text-muted-foreground">Estimated range</p>
          <p className="mt-1 text-3xl">{v.mid != null ? `${formatINR(v.low)} – ${formatINR(v.high)}` : v.low != null ? `Guideline floor ${formatINR(v.low)}` : "Not enough evidence"}</p>
          {v.mid != null && <p className="text-sm text-muted-foreground">Midpoint {formatINR(v.mid)} · {formatINR(v.perSqft)}/sq ft{kind === "rental" ? " per month" : ""}</p>}
          <p className="mt-4 text-sm"><b>Confidence:</b> {v.confidence}</p>
          <p className="text-sm"><b>Method:</b> {v.method}</p>
          {v.assumptions.length > 0 && <><p className="mt-4 text-sm font-medium">Assumptions</p><ul className="ml-5 list-disc text-sm text-muted-foreground">{v.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></>}
          {v.warnings.length > 0 && <><p className="mt-4 text-sm font-medium">Warnings</p><ul className="ml-5 list-disc text-sm text-destructive">{v.warnings.map((a) => <li key={a}>{a}</li>)}</ul></>}
          <p className="mt-6 text-xs text-muted-foreground">An estimate from the evidence you entered. Not a guaranteed sale value, bank valuation or legal opinion.</p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, set }: { label: string; value: string; set: (s: string) => void }) {
  return <label className="block text-sm font-medium">{label}<Input className="mt-1" inputMode="numeric" value={value} onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ""))} /></label>;
}
