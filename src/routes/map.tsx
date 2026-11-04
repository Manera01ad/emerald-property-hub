import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicPropertiesQuery, type Property } from "@/lib/data";
import { formatINR } from "@/lib/format";
import { parseLocationInput, validLatLng, type LatLng } from "@/lib/mapurl";
import { evidenceFlags, valueProperty, type Kind } from "@/lib/valuation";
import { transactionTypeOf } from "@/lib/transaction";
import { searchLocation } from "@/lib/open-location-search";
import { useSession } from "@/lib/auth";
import type { MapView } from "@/lib/map-layers";
import "leaflet/dist/leaflet.css";

export const Route = createFileRoute("/map")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.pages.dev/map" }],
    meta: [
      { property: "og:url", content: "https://emerald-property-hub.pages.dev/map" },
      { title: "Map intelligence — PropWise AI" },
      { name: "description", content: "Satellite, hybrid and terrain maps of verified PropWise listings in Chennai, with value estimates and official land-record links." },
      { property: "og:title", content: "Map intelligence — PropWise AI" },
      { property: "og:description", content: "Explore plots and properties on satellite maps. Imagery is for orientation only — never a legal boundary." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

const VIEWS = [
  ["roadmap", "Roadmap"],
  ["satellite", "Satellite"],
  ["hybrid", "Hybrid"],
  ["terrain", "Terrain"],
] as const;

const OFFICIAL = [
  ["Patta / Chitta & A-Register (TN e-Services)", "https://eservices.tn.gov.in/eservicesnew/index.html"],
  ["Encumbrance certificate & guideline value (TNREGINET)", "https://tnreginet.gov.in/"],
  ["TNRERA project registrations", "https://rera.tn.gov.in/"],
  ["CMDA planning permissions (Chennai)", "https://www.cmdachennai.gov.in/"],
  ["DTCP layout approvals (outside CMA)", "https://tcp.tn.gov.in/"],
] as const;

const CHENNAI: LatLng = { lat: 12.9249, lng: 80.1000 };

// Sample Verified Tamil Nadu Plots (Active when database has 0 listings)
const DEMO_PROPERTIES: Property[] = [
  {
    id: "demo-1",
    title: "1.0 Ground CMDA Villa Plot - Sholinganallur (OMR)",
    location: "Sholinganallur, Chennai",
    property_type: "plot",
    asking_price: "8500000",
    land_area_sqft: 2400,
    built_area_sqft: null,
    survey_number: "241/2A",
    guideline_value: 7200000,
    verification_status: "CMDA Approved",
    latitude: 12.9010,
    longitude: 80.2279,
    updated_at: new Date().toISOString(),
  } as unknown as Property,
  {
    id: "demo-2",
    title: "2.75 Cents DTCP Residential Plot - Tambaram West",
    location: "Mudichur Road, Tambaram",
    property_type: "plot",
    asking_price: "3800000",
    land_area_sqft: 1200,
    built_area_sqft: null,
    survey_number: "114/3B",
    guideline_value: 3000000,
    verification_status: "DTCP Approved",
    latitude: 12.9249,
    longitude: 80.1000,
    updated_at: new Date().toISOString(),
  } as unknown as Property,
  {
    id: "demo-3",
    title: "3.44 Cents Gated Layout Plot - Guduvanchery",
    location: "GST Road, Guduvanchery",
    property_type: "plot",
    asking_price: "4200000",
    land_area_sqft: 1500,
    built_area_sqft: null,
    survey_number: "88/1",
    guideline_value: 3500000,
    verification_status: "DTCP Approved",
    latitude: 12.8439,
    longitude: 80.0597,
    updated_at: new Date().toISOString(),
  } as unknown as Property,
  {
    id: "demo-4",
    title: "2.0 Grounds Premium Beachside Plot - Kovalam (ECR)",
    location: "ECR, Kovalam, Chennai",
    property_type: "plot",
    asking_price: "18500000",
    land_area_sqft: 4800,
    built_area_sqft: null,
    survey_number: "302/1",
    guideline_value: 15000000,
    verification_status: "DTCP Approved",
    latitude: 12.7926,
    longitude: 80.2520,
    updated_at: new Date().toISOString(),
  } as unknown as Property,
];

// SSR-Safe Leaflet Location Map Component
function LeafletLocationMap({
  center,
  view,
  pins,
  focus,
  onSelect,
}: {
  center: LatLng;
  view: MapView;
  pins: { id: string; point: LatLng; label: string }[];
  focus: { p: LatLng; label: string; approx: boolean } | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const groupRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const leafletRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current || mapRef.current) return;
    let mounted = true;

    import("leaflet").then((LModule) => {
      if (!mounted || !containerRef.current) return;
      const L = LModule.default || LModule;
      leafletRef.current = L;

      // Fix Leaflet icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@