import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AreaSummary } from "@/lib/area-intel";

/** Short, published area summary for the Explore sidebar. Renders nothing until an area guide exists for the chosen area. */
export function AreaBrief({ area }: { area: string }) {
  const { data } = useQuery({
    queryKey: ["area-brief", area],
    enabled: !!area,
    queryFn: async () => {
      const { data, error } = await supabase.from("area_intelligence").select("area, summary").eq("is_published", true).ilike("area", area).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
  if (!data) return null;
  const s = data.summary as unknown as AreaSummary;
  const rail = s.transport.rail.count + s.transport.metro.count;
  return (
    <div className="mt-4 rounded-lg border bg-background p-3 text-xs">
      <p className="text-sm font-medium text-foreground">About {data.area}</p>
      <p className="mt-1 text-muted-foreground">
        {s.water.count} water bodies within 2 km · {s.parks.count} parks · {s.transport.bus_stops} bus stops · {rail} train or metro station{rail === 1 ? "" : "s"} within 3 km
        {s.elevation_m != null ? ` · about ${Math.round(s.elevation_m)} m above sea level` : ""}.
      </p>
      <Link to="/location-intelligence" search={{ area: data.area }} className="mt-1 inline-block text-primary underline">Read the full area guide</Link>
    </div>
  );
}
