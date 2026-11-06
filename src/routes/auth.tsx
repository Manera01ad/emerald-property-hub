import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Sign In — PropWise AI" },
      { name: "description", content: "Sign in to save your property research." },
      { property: "og:title", content: "Sign In — PropWise AI" },
      { property: "og:description", content: "Sign in to save your property research." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string | undefined } => ({ next: typeof s['next'] === "string" ? (s['next'] as string) : undefined }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next: rawNext } = Route.useSearch();
  const next = rawNext ? oauthReturnPath(rawNext) : "/my";
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);
  // A cross-origin OAuth callback target (for example a consent screen) must be
  // a full-page navigation, not a router push.
  const go = () => { if (next.startsWith("/") && !next.startsWith("//")) navigate({ to: next }); else window.location.href = next; };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")), password = String(f.get("password"));
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      go();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL(next, window.location.origin).href } });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.session) go();
      else toast.success("Check your email to confirm your account.");
    }
  }

  async function google() {
    // Google sign-in is Supabase's own OAuth flow, so the provider is configured
    // in the Supabase project and this app carries no auth vendor. The browser is
    // redirected to the provider; the callback returns to `next`.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: new URL(next, window.location.origin).href },
    });
    if (error) toast.error("Google sign-in failed");
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-20">
      <h1 className="text-3xl">{mode === "in" ? "Sign in" : "Create account"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Save your preferences, cost analysis and reports. Browsing listings needs no account.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
        <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={8} required /></div>
        <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Sign up"}</Button>
      </form>
      <Button variant="outline" className="mt-3 w-full" onClick={google}>Continue with Google</Button>
      <button className="mt-6 text-sm text-primary hover:underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
