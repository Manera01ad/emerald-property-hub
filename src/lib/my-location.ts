import { useCallback, useSyncExternalStore } from "react";
import { useIsAdmin, useSession } from "./auth";
import { areaPoint } from "./areas";
import type { LatLng } from "./mapurl";

/** One shared "near me" setting (area or GPS, plus radius) used by every section that can filter by distance. */

/** Flip to true to open the near-me tools to every visitor. For now only administrators get them. */
export const NEAR_ME_PUBLIC = false;

type State = { area: string | null; gps: LatLng | null; radiusKm: number };
const KEY = "propwise:my-location";
let state: State = { area: null, gps: null, radiusKm: 10 };
const listeners = new Set<() => void>();

try {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  if (raw) { const p = JSON.parse(raw) as Partial<State>; state = { area: p.area ?? null, gps: null, radiusKm: [3, 5, 10, 15, 25].includes(Number(p.radiusKm)) ? Number(p.radiusKm) : 10 }; }
} catch { /* storage unavailable: defaults are fine */ }

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  // A precise GPS position is never saved, only the chosen area and radius.
  try { localStorage.setItem(KEY, JSON.stringify({ area: state.area, radiusKm: state.radiusKm })); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => void listeners.delete(l); };

export function useMyLocation() {
  const s = useSyncExternalStore(subscribe, () => state, () => state);
  const origin: LatLng | null = s.gps ?? (s.area ? areaPoint("Chennai", s.area) : null);
  return {
    ...s, origin,
    setArea: useCallback((area: string | null) => set({ area, gps: null }), []),
    setGps: useCallback((gps: LatLng | null) => set({ gps }), []),
    setRadius: useCallback((radiusKm: number) => set({ radiusKm }), []),
    clear: useCallback(() => set({ area: null, gps: null }), []),
  };
}

export function useNearMeAccess(): boolean {
  const { session } = useSession();
  const { data: isAdmin } = useIsAdmin(session?.user.id);
  return NEAR_ME_PUBLIC || !!isAdmin;
}
