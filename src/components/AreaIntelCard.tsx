import { Droplets, Trees, Bus, TrainFront, Mountain } from "lucide-react";
import type { AreaSummary, Group } from "@/lib/area-intel";

function Nearest({ g, empty }: { g: Group; empty: string }) {
  if (!g.nearest) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
      {(g.named.length ? g.named : [g.nearest]).slice(0, 3).map((f) => (
        <li key={f.name}>{f.name} · {f.km} km</li>
      ))}
    </ul>
  );
}

export function AreaIntelCard({ s, fetchedAt }: { s: AreaSummary; fetchedAt: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Droplets className="size-4 text-primary" /> Water within 2 km</p>
          <p className="mt-1 text-2xl font-display text-primary">{s.water.count}</p>
          <p className="text-xs text-muted-foreground">lakes, tanks, canals and drains mapped</p>
          <Nearest g={s.water} empty="None mapped" />
        </div>
        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Trees className="size-4 text-primary" /> Parks within 1.5 km</p>
          <p className="mt-1 text-2xl font-display text-primary">{s.parks.count}</p>
          <Nearest g={s.parks} empty="None mapped" />
        </div>
        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Bus className="size-4 text-primary" /> Bus stops within 1 km</p>
          <p className="mt-1 text-2xl font-display text-primary">{s.transport.bus_stops}</p>
          {s.transport.nearest_bus_km != null && <p className="text-xs text-muted-foreground">Nearest {s.transport.nearest_bus_km} km</p>}
        </div>
        <div className="rounded-lg border p-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><TrainFront className="size-4 text-primary" /> Train & metro within 3 km</p>
          <p className="mt-1 text-2xl font-display text-primary">{s.transport.rail.count + s.transport.metro.count}</p>
          <Nearest g={s.transport.rail} empty="No suburban station mapped" />
          {s.transport.metro.nearest && <Nearest g={s.transport.metro} empty="" />}
        </div>
      </div>
      <div className="rounded-lg border p-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><Mountain className="size-4 text-primary" /> Height above sea level: {s.elevation_m != null ? `${Math.round(s.elevation_m)} m` : "—"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{s.elevation_note}</p>
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
        {s.caveats.map((c) => <li key={c}>{c}</li>)}
        <li>Data checked {new Date(fetchedAt).toLocaleDateString("en-IN")}. Sources: © OpenStreetMap contributors; Open-Meteo elevation.</li>
      </ul>
    </div>
  );
}
