import { Droplets } from "lucide-react";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import type { FloodBrief } from "@/lib/flood";

/**
 * Flood and drainage context for one locality. Every fact shows its evidence
 * label; unknowns and ground checks are always shown, so an empty panel can
 * never be read as "no flood risk".
 */
export function FloodPanel({ brief, area }: { brief: FloodBrief; area: string }) {
  return (
    <div className="space-y-4" data-testid="flood-panel">
      <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm text-warning" data-testid="flood-headline">
        <Droplets className="mt-0.5 size-4 shrink-0" />
        <span>{brief.headline}</span>
      </p>

      <ul className="space-y-2">
        {brief.facts.map((f) => (
          <li key={f.key} className="rounded-lg border p-3" data-testid={`flood-fact-${f.key}`}>
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              {f.label}
              <EvidenceBadge evidence={f.evidence} />
            </p>
            <p className="mt-1 text-sm">{f.value ?? "Unknown"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{f.note}</p>
            {f.url && (
              <a href={f.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary hover:underline" data-testid={`flood-fact-${f.key}-source-link`}>
                View the official source
              </a>
            )}
          </li>
        ))}
      </ul>

      <div>
        <h3 className="text-lg">What we do not know about {area}</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground" data-testid="flood-unknowns">
          {brief.unknowns.map((u) => <li key={u}>{u}</li>)}
        </ul>
      </div>

      <div>
        <h3 className="text-lg">Check these yourself before you commit</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm" data-testid="flood-ground-checks">
          {brief.groundChecks.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </div>

      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        {brief.caveats.map((c) => <li key={c}>{c}</li>)}
      </ul>
    </div>
  );
}
