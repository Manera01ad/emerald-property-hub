import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { typeLabel } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { useMyLocation } from "@/lib/my-location";
import { nearMe } from "@/lib/nearme";
import { Panel, useAdminTable } from "./shared";

/** Administrators only: private items collected from authorised sources, near the shared "near me" point. */
export function NearbyFromSources() {
  const me = useMyLocation();
  const { data: obs = [], isLoading } = useAdminTable("source_observations", "last_seen_at");
  const result = useMemo(() => (me.origin ? nearMe([], obs, { origin: me.origin, radiusKm: me.radiusKm }) : null), [obs, me.origin, me.radiusKm]);
  if (!me.origin) return null;
  return (
    <Panel>
      <h3 className="text-lg">From your sources, within {me.radiusKm} km</h3>
      <p className="text-xs text-muted-foreground">Private. Collected only from sources you authorised. Distances marked ~ are to the middle of the area.</p>
      {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading…</p> : !result?.items.length ? (
        <p className="mt-3 text-sm text-muted-foreground">{obs.length === 0 ? "Nothing collected yet. Add an authorised source under AI Research Agents, or import a partner's CSV above." : "Nothing collected near this point. Try a wider radius."}</p>
      ) : (
        <ul className="mt-3 divide-y rounded-lg border text-sm">
          {result.items.map((i) => (
            <li key={i.key} className="flex flex-wrap items-start justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{i.title}</p>
                <p className="text-xs text-muted-foreground">{i.property_type ? typeLabel(i.property_type) : "Type unknown"} · {i.area}{i.bedrooms != null ? ` · ${i.bedrooms} bed` : ""}{i.sqft ? ` · ${Math.round(i.sqft)} sq ft` : ""}</p>
                {i.flags.length > 0 && <p className="mt-1 flex flex-wrap gap-1 text-xs">{i.flags.slice(0, 3).map((f) => <span key={f} className="rounded bg-warning/20 px-1.5 py-0.5">{f.replace(/_/g, " ")}</span>)}</p>}
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatINR(i.price)}</p>
                <p className="text-xs text-muted-foreground">~{i.km.toFixed(1)} km</p>
                {i.link && <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={i.link} target="_blank" rel="noopener noreferrer">Source <ExternalLink className="size-3" /></a>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {result && result.unmatchedObservations > 0 && <p className="mt-2 text-xs text-muted-foreground">{result.unmatchedObservations} collected item(s) skipped: area name not recognised.</p>}
    </Panel>
  );
}
