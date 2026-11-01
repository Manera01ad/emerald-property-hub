import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/lib/compare";
import { useSession } from "@/lib/auth";

/**
 * Discover is one product with three transaction types, so it is three links into
 * the same search page rather than three pages. `/properties` already reads
 * `?transaction=` and switches the terms and labels accordingly.
 */
const DISCOVER = [
  { transaction: "buy", label: "Buy" },
  { transaction: "rent", label: "Rent" },
  { transaction: "lease", label: "Lease" },
] as const;

const NAV = [
  { to: "/location-intelligence", label: "Localities" },
  { to: "/community", label: "Community" },
  { to: "/owners", label: "For owners" },
] as const;

/** The assistant is the primary entry point, so it sits first and is always visible. */
const ASK = { to: "/assistant", label: "Ask PropWise AI" } as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { ids } = useCompare();
  const { session } = useSession();
  const activityLabel = session ? "My activity" : "Sign in";
  const activityTo = session ? "/my" : "/auth";
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-semibold text-primary">PropWise</span>
          <span className="font-display text-2xl font-semibold text-gold">AI</span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          <Link
            to={ASK.to}
            className="text-sm font-semibold text-primary transition-colors hover:text-gold"
            activeProps={{ className: "text-gold" }}
          >
            {ASK.label}
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/60">
              Discover
            </span>
            {DISCOVER.map((d) => (
              <Link
                key={d.transaction}
                to="/properties"
                search={{ transaction: d.transaction }}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                activeOptions={{ includeSearch: true }}
                activeProps={{ className: "text-primary" }}
              >
                {d.label}
              </Link>
            ))}
          </div>
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/compare"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            activeProps={{ className: "text-primary" }}
          >
            Compare
            {ids.length > 0 && (
              <span className="ml-1 rounded-full bg-gold px-1.5 text-xs text-gold-foreground">
                {ids.length}
              </span>
            )}
          </Link>
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to={activityTo}>{activityLabel}</Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link to="/consult">Ask us</Link>
          </Button>
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-3 lg:hidden">
          <Link
            to={ASK.to}
            onClick={() => setOpen(false)}
            className="block py-2 text-sm font-semibold text-primary"
          >
            {ASK.label}
          </Link>
          <p className="pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/60">
            Discover
          </p>
          {DISCOVER.map((d) => (
            <Link
              key={d.transaction}
              to="/properties"
              search={{ transaction: d.transaction }}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium"
            >
              {d.label}
            </Link>
          ))}
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium"
            >
              {n.label}
            </Link>
          ))}
          <Link
            to="/compare"
            onClick={() => setOpen(false)}
            className="block py-2 text-sm font-medium"
          >
            Compare {ids.length > 0 && `(${ids.length})`}
          </Link>
          <Link
            to={activityTo}
            onClick={() => setOpen(false)}
            className="block py-2 text-sm text-muted-foreground"
          >
            {activityLabel}
          </Link>
          <Link
            to="/consult"
            onClick={() => setOpen(false)}
            className="block py-2 text-sm text-muted-foreground"
          >
            Ask us
          </Link>
        </nav>
      )}
      {ids.length > 0 && (
        <Link
          to="/compare"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-card md:hidden"
        >
          <Scale className="size-4" /> Compare {ids.length}
        </Link>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-hero text-hero-foreground">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-display text-2xl">
            PropWise <span className="text-gold">AI</span>
          </p>
          <p className="mt-2 max-w-sm text-sm opacity-75">
            Locality intelligence and community for Chennai and nearby Tamil Nadu.
          </p>
          <p className="mt-4 max-w-md text-xs opacity-60">
            All costs and scores are estimates. Verify documents, approvals and RERA registration
            independently before purchase.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gold">Explore</p>
          <Link to="/properties" className="block opacity-80 hover:opacity-100">
            Find a property
          </Link>
          <Link to="/location-intelligence" className="block opacity-80 hover:opacity-100">
            Localities
          </Link>
          <Link to="/community" className="block opacity-80 hover:opacity-100">
            Community
          </Link>
          <Link to="/owners" className="block opacity-80 hover:opacity-100">
            For owners
          </Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gold">Trust</p>
          <Link to="/privacy" className="block opacity-80 hover:opacity-100">
            Privacy Policy
          </Link>
          <Link to="/terms" className="block opacity-80 hover:opacity-100">
            Terms
          </Link>
          <Link to="/disclaimer" className="block opacity-80 hover:opacity-100">
            Disclaimer & RERA
          </Link>
          <Link to="/contact" className="block opacity-80 hover:opacity-100">
            Contact
          </Link>
        </div>
      </div>
      <div className="border-t border-hero-foreground/10 py-4 text-center text-xs opacity-60">
        © {new Date().getFullYear()} PropWise AI
      </div>
    </footer>
  );
}
