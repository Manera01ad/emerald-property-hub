/** Shared MapLibre loader and OpenStreetMap raster style, so pages do not each fetch the library. */

const ML_VERSION = "4.7.1";

declare global {
  interface Window {
    maplibregl?: any;
  }
}

let loader: Promise<any> | null = null;

/** MapLibre is loaded from a CDN so the app needs no new package. Map tiles are OpenStreetMap. */
export function loadMapLibre(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `https://unpkg.com/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `https://unpkg.com/maplibre-gl@${ML_VERSION}/dist/maplibre-gl.js`;
    s.async = true;
    s.onload = () => resolve(window.maplibregl);
    s.onerror = () => {
      loader = null;
      reject(new Error("Map library failed to load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

export const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};
