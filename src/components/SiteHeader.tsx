import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompare } from "@/lib/compare";
import { useSession } from "@/lib/auth";

const NAV = [
  { to: "/properties", label: "Properties" },
  { to: "/compare", label: "Compare" },
  { to: "/explore", label: "Explore" },
  { to: "/map", label: "Map" },
  { to: "/valuation", label: "Valuation" },
  { to: "/research-services", label: "Research" },
  { to: "/infrastructure", label: "Infrastructure" },
  { to: "/consult", label: "Consult" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { ids } = useCompare();
  const { session } = useSession();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-semibold text-primary">PropWise</span>
          <span className="font-display text-2xl font-semibold text-gold">AI</span>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              activeProps={{ className: "text-primary" }}
            >
              {n.label}
              {n.to === "/compare" && ids.length > 0 && (
                <span className="ml-1 rounded-full bg-gold px-1.5 text-xs text-gold-foreground">{ids.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to={session ? "/my" : "/auth"}>{session ? "My research" : "Sign in"}</Link>
          </Button>
          {session && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/assistant">Ask PropWise</Link>
            </Button>
          )}
          <Button asChild variant="gold" size="sm">
            <Link to="/consult">Book a consultation</Link>
          </Button>
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="border-t bg-background px-4 py-3 lg:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">
              {n.label} {n.to === "/compare" && ids.length > 0 && `(${ids.length})`}
            </Link>
          ))}
          <Link to={session ? "/my" : "/auth"} onClick={() => setOpen(false)} className="block py-2 text-sm text-muted-foreground">
            {session ? "My research" : "Sign in"}
          </Link>
          {session && (
            <Link to="/assistant" onClick={() => setOpen(false)} className="block py-2 text-sm text-muted-foreground">Ask PropWise</Link>
          )}
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
          <p className="mt-2 max-w-sm text-sm opacity-75">Compare Smarter. Buy with Confidence. Property guidance for Chennai and nearby Tamil Nadu.</p>
          <p className="mt-4 max-w-md text-xs opacity-60">
            All costs and scores are estimates. Verify documents, approvals and RERA registration independently before purchase.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gold">Explore</p>
          <Link to="/properties" className="block opacity-80 hover:opacity-100">Properties</Link>
          <Link to="/compare" className="block opacity-80 hover:opacity-100">Compare</Link>
          <Link to="/infrastructure" className="block opacity-80 hover:opacity-100">Infrastructure</Link>
          <Link to="/consult" className="block opacity-80 hover:opacity-100">Consultation</Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold text-gold">Trust</p>
          <Link to="/privacy" className="block opacity-80 hover:opacity-100">Privacy Policy</Link>
          <Link to="/terms" className="block opacity-80 hover:opacity-100">Terms</Link>
          <Link to="/disclaimer" className="block opacity-80 hover:opacity-100">Disclaimer & RERA</Link>
          <Link to="/contact" className="block opacity-80 hover:opacity-100">Contact</Link>
        </div>
      </div>
      <div className="border-t border-hero-foreground/10 py-4 text-center text-xs opacity-60">© {new Date().getFullYear()} PropWise AI</div>
    </footer>
  );
}
