import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Button } from "@/components/ui/button";
import { mapLayers, type MapView } from "@/lib/map-layers";
import type { LatLng } from "@/lib/mapurl";

export type LocationPin = { id: string; point: LatLng; label: string };
type Props = {
  center: LatLng;
  zoom?: number;
  view?: MapView;
  pins?: LocationPin[];
  focus?: { p: LatLng; label: string } | null;
  onSelect?: (id: string) => void;
};

export function LocationMap({ center, zoom = 11, view = "roadmap", pins = [], focus, onSelect }: Props) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const library = useRef<typeof Leaflet | null>(null);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [tileError, setTileError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    setError("");
    import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      library.current = L;
      const instance = L.map(element.current, { center: [center.lat, center.lng], zoom, maxZoom: 20, scrollWheelZoom: true });
      map.current = instance;
      observer = new ResizeObserver(() => instance.invalidateSize());
      observer.observe(element.current);
      setReady(true);
    }).catch(() => { if (!cancelled) setError("The map couldn't start. Please try again."); });
    return () => { cancelled = true; observer?.disconnect(); map.current?.remove(); map.current = null; setReady(false); };
  }, [attempt]);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    if (!ready || !L || !instance) return;
    setTileError(false);
    const layers = mapLayers(view).map((definition) => {
      const layer = L.tileLayer(definition.url, { attribution: definition.attribution, maxNativeZoom: definition.maxNativeZoom, maxZoom: 20 });
      layer.on("tileerror", () => setTileError(true));
      return layer.addTo(instance);
    });
    return () => { layers.forEach((layer) => { layer.off(); layer.remove(); }); };
  }, [ready, view, attempt]);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    if (!ready || !L || !instance) return;
    const group = L.layerGroup().addTo(instance);
    pins.forEach((pin) => {
      const tooltip = document.createElement("span");
      tooltip.textContent = pin.label;
      L.marker([pin.point.lat, pin.point.lng], {
        icon: L.divIcon({ className: "property-map-pin", html: '<span class="property-map-pin-dot"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
        title: pin.label,
      }).bindTooltip(tooltip).on("click", () => selection.current?.(pin.id)).addTo(group);
    });
    return () => { group.remove(); };
  }, [ready, pins]);

  useEffect(() => {
    const L = library.current;
    const instance = map.current;
    if (!ready || !L || !instance || !focus) return;
    instance.setView([focus.p.lat, focus.p.lng], 18);
    const marker = L.marker([focus.p.lat, focus.p.lng], {
      icon: L.divIcon({ className: "property-map-pin", html: '<span class="property-map-pin-dot property-map-focus-dot"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
      title: focus.label,
    }).addTo(instance);
    return () => { marker.remove(); };
  }, [ready, focus]);

  return (
    <div className="relative isolate h-full w-full" aria-label="Location map">
      <div ref={element} className="h-full w-full" />
      {!ready && <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-muted p-4 text-center text-sm text-muted-foreground" role="status">
        {error || "Loading map…"}
        {error && <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}
      </div>}
      {tileError && <div className="absolute left-2 right-2 top-2 z-[1000] flex items-center justify-between gap-2 rounded border bg-background p-2 text-xs" role="status">
        <span>Some map tiles couldn't load. Check your connection or try another view.</span>
        <Button size="sm" variant="outline" onClick={() => { setTileError(false); setAttempt((n) => n + 1); }}>Retry</Button>
      </div>}
    </div>
  );
}