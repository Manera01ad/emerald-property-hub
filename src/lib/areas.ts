import type { LatLng } from "./mapurl";

/** Approximate centre points of localities, used for the "near my area" filter. Add cities here as you expand. */
export const AREAS: Record<string, Record<string, LatLng>> = {
  Chennai: {
    "Adyar": { lat: 13.0067, lng: 80.257 },
    "Alandur": { lat: 13.003, lng: 80.201 },
    "Ambattur": { lat: 13.1143, lng: 80.1548 },
    "Anna Nagar": { lat: 13.085, lng: 80.2101 },
    "Ashok Nagar": { lat: 13.0373, lng: 80.2123 },
    "Avadi": { lat: 13.1067, lng: 80.097 },
    "Besant Nagar": { lat: 13.0002, lng: 80.2668 },
    "Chromepet": { lat: 12.9516, lng: 80.1462 },
    "Egmore": { lat: 13.0732, lng: 80.2609 },
    "Guduvancheri": { lat: 12.845, lng: 80.06 },
    "Guindy": { lat: 13.0067, lng: 80.2206 },
    "KK Nagar": { lat: 13.0415, lng: 80.199 },
    "Kelambakkam": { lat: 12.787, lng: 80.225 },
    "Kilpauk": { lat: 13.0836, lng: 80.24 },
    "Koyambedu": { lat: 13.0694, lng: 80.1948 },
    "Madipakkam": { lat: 12.9626, lng: 80.1986 },
    "Maraimalai Nagar": { lat: 12.7936, lng: 80.0262 },
    "Medavakkam": { lat: 12.92, lng: 80.192 },
    "Mogappair": { lat: 13.085, lng: 80.175 },
    "Mylapore": { lat: 13.0368, lng: 80.2676 },
    "Navalur": { lat: 12.8456, lng: 80.2265 },
    "Nungambakkam": { lat: 13.0569, lng: 80.2425 },
    "Pallavaram": { lat: 12.9675, lng: 80.1491 },
    "Pallikaranai": { lat: 12.934, lng: 80.214 },
    "Pammal": { lat: 12.968, lng: 80.135 },
    "Pattabiram": { lat: 13.123, lng: 80.063 },
    "Perambur": { lat: 13.118, lng: 80.24 },
    "Perungudi": { lat: 12.965, lng: 80.2461 },
    "Poonamallee": { lat: 13.0473, lng: 80.0945 },
    "Porur": { lat: 13.0382, lng: 80.1565 },
    "Potheri": { lat: 12.8231, lng: 80.0442 },
    "Saidapet": { lat: 13.0213, lng: 80.2231 },
    "Selaiyur": { lat: 12.906, lng: 80.14 },
    "Sholinganallur": { lat: 12.901, lng: 80.2279 },
    "Siruseri": { lat: 12.824, lng: 80.225 },
    "T. Nagar": { lat: 13.0418, lng: 80.2341 },
    "Tambaram": { lat: 12.9249, lng: 80.1 },
    "Taramani": { lat: 12.9863, lng: 80.242 },
    "Thiruvanmiyur": { lat: 12.983, lng: 80.2594 },
    "Thiruverkkadu": { lat: 13.0764, lng: 80.1224 },
    "Thoraipakkam": { lat: 12.941, lng: 80.236 },
    "Urapakkam": { lat: 12.868, lng: 80.075 },
    "Vadapalani": { lat: 13.05, lng: 80.2121 },
    "Vandalur": { lat: 12.8923, lng: 80.081 },
    "Velachery": { lat: 12.9815, lng: 80.218 },
  },
};

export const CITIES = Object.keys(AREAS);
export const RADIUS_OPTIONS = [3, 5, 10, 15, 25] as const;

export function areaPoint(city: string, area: string): LatLng | null {
  return AREAS[city]?.[area] ?? null;
}
