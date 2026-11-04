export type MapView = "roadmap" | "satellite" | "hybrid" | "terrain";

const osm = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxNativeZoom: 19,
};
const imagery = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: 'Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  maxNativeZoom: 19,
};
const labels = {
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  attribution: 'Labels &copy; Esri, HERE, Garmin, and the GIS User Community',
  maxNativeZoom: 19,
};
const terrain = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  attribution: 'Tiles &copy; Esri, HERE, Garmin, USGS, NGA, and the GIS User Community',
  maxNativeZoom: 19,
};

export function mapLayers(view: MapView) {
  switch (view) {
    case "roadmap": return [osm];
    case "satellite": return [imagery];
    case "hybrid": return [imagery, labels];
    case "terrain": return [terrain];
  }
}