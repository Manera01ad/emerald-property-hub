import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when a Phase 1 feature is switched off. The feature is not open to anyone yet. */
export function NotOpenYet({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <Lock className="mx-auto size-8 text-muted-foreground" />
      <h1 className="mt-4 text-3xl">{title}</h1>
      <p className="mt-2 text-sm font-medium uppercase tracking-wide text-gold">Not open yet</p>
      <p className="mt-3 text-muted-foreground">
        {children ?? "This part of PropWise AI is built but switched off while we finish checking it."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild variant="gold"><Link to="/properties">Find a property</Link></Button>
        <Button asChild variant="outline"><Link to="/location-intelligence">Localities</Link></Button>
      </div>
    </div>
  );
}
