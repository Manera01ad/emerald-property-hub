import { useSyncExternalStore } from "react";
import { MAX_COMPARE } from "./constants";

const KEY = "propwise-compare";
const listeners = new Set<() => void>();
let cache: string[] | null = null;

function read(): string[] {
  if (typeof window === "undefined") return [];
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    cache = [];
  }
  return cache!;
}
function write(ids: string[]) {
  cache = ids;
  localStorage.setItem(KEY, JSON.stringify(ids));
  listeners.forEach((l) => l());
}
const EMPTY: string[] = [];

export function useCompare() {
  const ids = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    () => EMPTY,
  );
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string): boolean => {
      if (ids.includes(id)) return write(ids.filter((x) => x !== id)), true;
      if (ids.length >= MAX_COMPARE) return false;
      write([...ids, id]);
      return true;
    },
    remove: (id: string) => write(ids.filter((x) => x !== id)),
    clear: () => write([]),
  };
}
