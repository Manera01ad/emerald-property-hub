import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Calculator, GitCompareArrows, MapPinned, ShieldCheck, Search } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { Button } from "@/components/ui/button";
import { MARKETS } from "@/lib/constants";
import { publicPropertiesQuery } from "@/lib/data";
import { PropertyCard } from "@/components/PropertyCard";
import { InstallAppButton } from "@/components/InstallAppButton";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/" },
      { title: "PropWise AI — Compare Chennai Properties with Confidence" },
      { name: "description", content: "Search, compare and analyse villas, apartments and plots in Chennai. See full purchase cost, nearby schools and get expert advice." },
      { property: "og:title", content: "PropWise AI — Compare Smarter. Buy with Confidence." },
      { property: "og:description", content: "Property comparison and consulting for Chennai and nearby Tamil Nadu." },
    ],
  }),
  component: Home,
});

const FEATURES = [
  { icon: GitCompareArrows, title: "Side-by-side comparison", text: "Compare up to four properties on price, area, approvals and documents." },
  { icon: Calculator, title: "True purchase cost", text: "Stamp duty, registration and legal fees estimated using Tamil Nadu rules." },
  { icon: MapPinned, title: "Location intelligence", text: "Nearby CBSE schools, hospitals, transport and infrastructure — with sources." },
  { icon: ShieldCheck, title: "Verification first", text: "Every listing shows what's verified, what's missing, and where it came from." },
];

function Home() {
  const navigate = useNavigate();
  const [loc, setLoc] = useState("");
  const { data: props } = useQuery(publicPropertiesQuery);
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <img src={hero} alt="Residential neighbourhood near Chennai" width={1600} height={912} className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="hero-overlay absolute inset-0 -z-10" />
        <div className="mx-auto max-w-7xl px-4 py-28 text-hero-foreground md:py-40">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Chennai · Tamil Nadu</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-tight md:text-6xl">Compare Smarter.<br />Buy with Confidence.</h1>
          <p className="mt-5 max-w-xl text-lg opacity-85">Understand the real cost, the neighbourhood and the paperwork before you commit.</p>
          <form
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/properties", search: loc ? { location: loc } : {} }); }}
            className="mt-8 flex max-w-xl flex-col gap-2 rounded-xl bg-background p-2 sm:flex-row"
          >
            <select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-11 flex-1 rounded-md bg-transparent px-3 text-sm text-foreground outline-none">
              <option value="">All locations</option>
              {MARKETS.map((m) => <option key={m}>{m}</option>)}
            </select>
            <Button type="submit" variant="gold" size="lg" className="h-11"><Search /> Search properties</Button>
          </form>
          <InstallAppButton className="mt-4 h-11 border-hero-foreground/40 bg-transparent text-hero-foreground hover:bg-hero-foreground/10 hover:text-hero-foreground" />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-20 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 shadow-card">
            <f.icon className="size-7 text-gold" />
            <h3 className="mt-4 text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl">Latest listings</h2>
          <Link to="/properties" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        <div className="gold-rule my-6" />
        {props && props.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{props.slice(0, 6).map((p) => <PropertyCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
            Verified listings are being added. <Link to="/consult" className="text-primary underline">Tell us what you're looking for</Link> and we'll find options for you.
          </div>
        )}
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4">
        <h2 className="text-3xl">Markets we cover</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          {MARKETS.map((m) => (
            <Link key={m} to="/properties" search={{ location: m }} className="rounded-full border bg-card px-5 py-2 text-sm hover:border-primary hover:text-primary">{m}</Link>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-4">
        <div className="rounded-2xl bg-hero p-10 text-hero-foreground md:p-14">
          <h2 className="text-3xl md:text-4xl">Ask us about an area</h2>
          <p className="mt-3 max-w-xl opacity-80">Get help understanding an area, reading the evidence on a listing and knowing which documents and approvals to check.</p>
          <Button asChild variant="gold" size="lg" className="mt-6"><Link to="/consult">Ask us a question</Link></Button>
        </div>
      </section>
    </>
  );
}
