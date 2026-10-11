import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, MapPin, MessageCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VerificationBadge, EstimateNote } from "@/components/Badges";
import { EnquiryForm } from "@/components/EnquiryForm";
import { AVAILABILITY, DOCS, PLACE_CATEGORIES, typeLabel } from "@/lib/constants";
import { costRulesFrom, publicPropertiesQuery, usePhotoUrls, useSettings, whatsappLink } from "@/lib/data";
import { dealScore, negotiationHints, pricePerSqft, purchaseCost } from "@/lib/deal";
import { formatINR, formatINRFull } from "@/lib/format";
import { useCompare } from "@/lib/compare";

export const Route = createFileRoute("/properties/$id")({
  head: () => ({
    meta: [
      { title: "Property details — PropWise AI" },
      { name: "description", content: "Specifications, full purchase cost estimate, deal score and nearby amenities." },
      { property: "og:title", content: "Property details — PropWise AI" },
      { property: "og:description", content: "See the real cost and verification status before you buy." },
    ],
  }),
  component: PropertyPage,
});

function PropertyPage() {
  const { id } = Route.useParams();
  const { data: p, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => (await supabase.from("properties").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: places = [] } = useQuery({
    queryKey: ["places", id],
    queryFn: async () => (await supabase.from("nearby_places").select("*").eq("property_id", id).order("distance_km")).data ?? [],
  });
  const { data: pool = [] } = useQuery(publicPropertiesQuery);
  const { data: settings } = useSettings();
  const { data: photos = [] } = usePhotoUrls(p?.photos);
  const [active, setActive] = useState(0);
  const [form, setForm] = useState<null | "consultation" | "site_visit">(null);
  const { has, toggle } = useCompare();

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-20 text-muted-foreground">Loading…</div>;
  if (!p) return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-3xl">Listing not available</h1>
      <p className="mt-2 text-muted-foreground">It may have been sold, archived or is awaiting verification.</p>
      <Button asChild className="mt-6"><Link to="/properties">Browse properties</Link></Button>
    </div>
  );

  const rules = costRulesFrom(settings);
  const cost = purchaseCost(p, rules);
  const score = dealScore(p, pool, places);
  const hints = negotiationHints(p, pool);
  const ppsf = pricePerSqft(p);
  const wa = whatsappLink(settings?.whatsapp_number, `Hi PropWise, I'm interested in: ${p.title} (${p.location})`);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      {p.is_demo && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="size-4" /> DEMO record for testing only — not a real property and hidden from the public.
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div>
            <div className="aspect-[16/10] overflow-hidden rounded-xl bg-muted">
              {photos[active] ? <img src={photos[active]} alt={p.title} className="h-full w-full object-cover" /> :
                <div className="flex h-full items-center justify-center text-muted-foreground">No photos uploaded yet</div>}
            </div>
            {photos.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {photos.map((u, i) => (
                  <button key={u} onClick={() => setActive(i)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 ${i === active ? "border-gold" : "border-transparent"}`}>
                    <img src={u} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{typeLabel(p.property_type)}</span>
              <VerificationBadge status={p.verification_status} />
              <span className="text-xs text-muted-foreground">{AVAILABILITY[p.availability]}</span>
            </div>
            <h1 className="mt-3 text-3xl md:text-4xl">{p.title}</h1>
            <p className="mt-2 flex items-center gap-1 text-muted-foreground"><MapPin className="size-4" />{p.address ? `${p.address}, ` : ""}{p.location}</p>
            {p.description && <p className="mt-4 whitespace-pre-line leading-relaxed">{p.description}</p>}
          </div>

          <Section title="Specifications">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Spec k="Asking price" v={formatINRFull(p.asking_price)} />
              <Spec k="Price / sq ft" v={ppsf ? formatINRFull(ppsf) : "—"} />
              <Spec k="Bedrooms" v={p.bedrooms ?? "—"} />
              <Spec k="Built-up area" v={p.built_area_sqft ? `${p.built_area_sqft} sq ft` : "—"} />
              <Spec k="Land area" v={p.land_area_sqft ? `${p.land_area_sqft} sq ft` : "—"} />
              <Spec k="Approvals" v={p.approvals.join(", ") || "Not recorded"} />
              <Spec k="RERA no." v={p.rera_number || "Not provided"} />
              <Spec k="Source" v={p.source || "Not recorded"} />
              <Spec k="Guideline value" v={p.guideline_value ? formatINRFull(p.guideline_value) : "Not recorded"} />
            </dl>
            {p.amenities.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{p.amenities.map((a) => <span key={a} className="rounded-full border px-3 py-1 text-xs">{a}</span>)}</div>}
          </Section>

          <Section title="Legal documentation">
            <ul className="grid gap-2 sm:grid-cols-2">
              {DOCS.map((d) => {
                const ok = p[d.key as keyof typeof p];
                return (
                  <li key={d.key} className="flex items-center gap-2 text-sm">
                    {ok ? <CheckCircle2 className="size-4 text-success" /> : <XCircle className="size-4 text-destructive" />}
                    <span className={ok ? "" : "text-destructive"}>{d.label}{!ok && " — missing"}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Recorded by PropWise from documents shared with us. Always have a lawyer review originals.</p>
          </Section>

          <Section title="Deal analysis">
            <div className="flex items-center gap-4">
              <div className="flex size-20 items-center justify-center rounded-full border-4 border-gold font-display text-3xl text-primary">{score.overall ?? "–"}</div>
              <p className="text-sm text-muted-foreground">Transparent score out of 100, averaged from the parts below that have enough data.</p>
            </div>
            <div className="mt-5 space-y-3">
              {score.parts.map((s) => (
                <div key={s.key}>
                  <div className="flex justify-between text-sm"><span className="font-medium">{s.label}</span><span>{s.score ?? "Insufficient data"}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${s.score ?? 0}%` }} /></div>
                  <p className="mt-1 text-xs text-muted-foreground">{s.reason}</p>
                </div>
              ))}
            </div>
            {score.comps.count > 0 && (
              <p className="mt-4 text-sm">Comparable listings: {score.comps.count} · average {formatINR(score.comps.avgPpsf)}/sq ft</p>
            )}
            {hints.length > 0 && (
              <div className="mt-5 rounded-lg bg-gold-soft p-4">
                <p className="text-sm font-semibold text-accent-foreground">Possible negotiation points</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
              </div>
            )}
            <div className="mt-4"><EstimateNote>Based only on listings in PropWise — not a market valuation. We do not predict appreciation.</EstimateNote></div>
          </Section>

          <Section title="Location intelligence">
            {places.length === 0 ? <p className="text-sm text-muted-foreground">Nearby-place data has not been added for this listing yet.</p> : (
              <div className="grid gap-4 sm:grid-cols-2">
                {Object.entries(PLACE_CATEGORIES).map(([k, label]) => {
                  const list = places.filter((x) => x.category === k);
                  if (!list.length) return null;
                  return (
                    <div key={k}>
                      <p className="text-sm font-semibold">{label}</p>
                      <ul className="mt-1 space-y-1 text-sm">
                        {list.map((x) => (
                          <li key={x.id} className="flex justify-between gap-2">
                            <span>{x.name}{!x.verified && <span className="ml-1 text-xs text-warning">(unverified)</span>}{x.source && <span className="block text-xs text-muted-foreground">Source: {x.source}</span>}</span>
                            <span className="text-muted-foreground">{x.distance_km != null ? `${x.distance_km} km` : "—"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
            {p.latitude && p.longitude && import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY && (
              <iframe title="Property location map" loading="lazy" className="mt-4 h-64 w-full rounded-lg border" referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY}&q=${p.latitude},${p.longitude}&zoom=14`} />
            )}
            {p.latitude && p.longitude && (
              <a className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}>
                Open location in Google Maps <ExternalLink className="size-3.5" />
              </a>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Distances are straight-line estimates with their source shown, not travel distances or times.</p>
          </Section>
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-20">
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <p className="text-sm text-muted-foreground">Asking price</p>
            <p className="font-display text-4xl text-primary">{formatINR(p.asking_price)}</p>
            <div className="gold-rule my-4" />
            <p className="text-sm font-semibold">Estimated total purchase cost</p>
            <dl className="mt-2 space-y-1.5 text-sm">
              <Row k="Property price" v={formatINRFull(p.asking_price)} />
              <Row k={`Stamp duty (${rules.stampDutyPct}%)`} v={formatINRFull(cost.stampDuty)} />
              <Row k={`Registration (${rules.registrationPct}%)`} v={formatINRFull(cost.registration)} />
              <Row k="Legal & documentation" v={formatINRFull(cost.legal)} />
              <div className="border-t pt-2"><Row k={<b>Total</b>} v={<b>{formatINRFull(cost.total)}</b>} /></div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">Duties calculated on {cost.base > Number(p.asking_price) ? "guideline value" : "asking price"}. Estimate only.</p>
            <div className="mt-5 space-y-2">
              <Button variant="gold" className="w-full" onClick={() => setForm("site_visit")}>Book a site visit</Button>
              <Button variant="default" className="w-full" onClick={() => setForm("consultation")}>Ask a consultant</Button>
              {wa && <Button asChild variant="outline" className="w-full"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp us</a></Button>}
              <Button variant="ghost" className="w-full" onClick={() => { if (!toggle(p.id)) toast.error("You can compare up to 4 properties."); }}>
                {has(p.id) ? "Remove from compare" : "Add to compare"}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form === "site_visit" ? "Book a site visit" : "Request a consultation"}</DialogTitle></DialogHeader>
          {form && <EnquiryForm type={form} propertyId={p.id} propertyTitle={p.title} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-card p-6 shadow-card"><h2 className="mb-4 text-xl">{title}</h2>{children}</section>;
}
function Spec({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>;
}
function Row({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>;
}
