import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/research-services")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/research-services" }],
    meta: [
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/research-services" },
      { title: "Independent research services — PropWise AI" },
      { name: "description", content: "Buyer-paid property research reports, alerts and field observations for Chennai. Independent of sellers." },
      { property: "og:title", content: "Independent research services — PropWise AI" },
      { property: "og:description", content: "Research paid for by buyers, never by sellers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Services,
});

const SERVICES = [
  { t: "Property research report", d: "Value range, comparable evidence, cost estimate, missing-information flags and questions to ask." },
  { t: "Research subscription", d: "Saved searches, price-change alerts and locality updates." },
  { t: "Field observation visit", d: "A fixed-fee visit to photograph and note the site, access road and surroundings." },
  { t: "Locality briefing", d: "Infrastructure projects by stage (announced, approved, under construction, completed) with sources." },
];

function Services() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <h1 className="text-4xl">Independent research services</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Paid for by buyers only. We take no seller-introduction fee and nothing depends on whether you buy. Prices and payments are not live yet.</p>
      <div className="gold-rule my-6" />
      <div className="grid gap-6 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <div key={s.t} className="rounded-xl border bg-card p-6 shadow-card">
            <h2 className="text-xl">{s.t}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gold">Coming soon</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Our research never certifies legal title or approvals. Have documents checked by an independent lawyer.</p>
      <Button asChild variant="gold" className="mt-6"><Link to="/valuation">Try the value estimator</Link></Button>
    </div>
  );
}
