import { LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AREAS, RADIUS_OPTIONS } from "@/lib/areas";
import { useMyLocation, useNearMeAccess } from "@/lib/my-location";

const sel = "h-9 rounded-md border border-input bg-background px-2 text-sm";

/** The shared "near me" control. Renders nothing for people who don't have access yet. */
export function MyLocationBar({ className = "" }: { className?: string }) {
  const access = useNearMeAccess();
  const me = useMyLocation();
  if (!access) return null;
  function locate() {
    if (!navigator.geolocation) return void toast.error("This browser can't share your location. Pick an area instead.");
    navigator.geolocation.getCurrentPosition(
      (p) => me.setGps({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Couldn't get your location. Allow location access, or pick an area."),
      { timeout: 10000 },
    );
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm ${className}`}>
      <span className="font-medium">Near me</span>
      <select aria-label="My area" className={sel} value={me.gps ? "__gps" : me.area ?? ""} onChange={(e) => me.setArea(e.target.value || null)}>
        <option value="">Anywhere</option>
        {me.gps && <option value="__gps" disabled>My current location</option>}
        {Object.keys(AREAS["Chennai"]!).map((a) => <option key={a}>{a}</option>)}
      </select>
      <Button type="button" variant="outline" size="icon" onClick={locate} aria-label="Use my current location"><LocateFixed /></Button>
      <select aria-label="Within" className={sel} value={me.radiusKm} disabled={!me.origin} onChange={(e) => me.setRadius(Number(e.target.value))}>
        {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>within {r} km</option>)}
      </select>
      {me.origin && <Button type="button" variant="ghost" size="sm" onClick={me.clear}>Clear</Button>}
    </div>
  );
}
