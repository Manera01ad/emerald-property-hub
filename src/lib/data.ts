import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { localityDb } from "./localities-data";
import { sortLocalities, visibleLocalities, type Locality } from "./localities";
import type { CostRules } from "./deal";

export type Property = Tables<"properties">;
export type Place = Tables<"nearby_places">;

export type Settings = Partial<
  Record<
    | "stamp_duty_pct"
    | "registration_pct"
    | "legal_fee_flat"
    | "whatsapp_number"
    | "contact_email"
    | "contact_phone"
    | "rera_agent_status"
    | "feature_community"
    | "feature_owner_submissions"
    | "feature_interest_requests",
    string
  >
>;

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("key,value,label");
    if (error) throw error;
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value])) as Settings;
  },
  staleTime: 60_000,
});

export function useSettings() {
  return useQuery(settingsQuery);
}

export function costRulesFrom(s?: Settings): CostRules {
  return {
    stampDutyPct: Number(s?.stamp_duty_pct ?? 7),
    registrationPct: Number(s?.registration_pct ?? 2),
    legalFee: Number(s?.legal_fee_flat ?? 0),
  };
}

export function whatsappLink(number: string | undefined, text: string) {
  const n = (number ?? "").replace(/\D/g, "");
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Active localities only. This is the one selector every new form uses. */
export const localitiesQuery = queryOptions({
  queryKey: ["localities", "active"],
  queryFn: async () => {
    const { data, error } = await localityDb().from("localities").select("*").eq("status", "active");
    if (error) throw new Error(error.message);
    return sortLocalities((data ?? []) as Locality[]);
  },
  staleTime: 10 * 60_000,
});

export function useLocalities() {
  return useQuery(localitiesQuery);
}

/** Admin view: every locality, including hidden ones, so tiers can be edited. */
export function useAllLocalities() {
  return useQuery({
    queryKey: ["localities", "all"],
    queryFn: async () => {
      const { data, error } = await localityDb().from("localities").select("*");
      if (error) throw new Error(error.message);
      return sortLocalities((data ?? []) as Locality[]);
    },
  });
}

export { visibleLocalities };

/** Published listings visible to the public (RLS also hides demo and unpermitted rows for visitors). */
export const publicPropertiesQuery = queryOptions({
  queryKey: ["properties", "public"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("status", "published")
      .eq("is_demo", false)
      .eq("listing_permission", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

/** Resolve photo entries: full URLs pass through, storage paths get a temporary signed URL. */
export function usePhotoUrls(photos: string[] | null | undefined) {
  const list = photos ?? [];
  return useQuery({
    queryKey: ["photos", list],
    enabled: list.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const paths = list.filter((p) => !/^https?:\/\//.test(p));
      const signed: Record<string, string> = {};
      if (paths.length) {
        const { data } = await supabase.storage.from("property-photos").createSignedUrls(paths, 3600);
        data?.forEach((d) => d.path && d.signedUrl && (signed[d.path] = d.signedUrl));
      }
      return list.map((p) => (/^https?:\/\//.test(p) ? p : signed[p])).filter(Boolean) as string[];
    },
  });
}
