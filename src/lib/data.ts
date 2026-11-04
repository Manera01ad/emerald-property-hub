import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { localityDb } from "./localities-data";
import { sortLocalities, visibleLocalities, type Locality } from "./localities";
import { canSignPhotos } from "./photo-access";
import { signAdminPhotos, signPublicPhotos } from "./photo-signing.functions";
import { useIsAdmin, useSession } from "./auth";
import type { VisibilityInput } from "./visibility";
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

/**
 * Resolve photo entries: full URLs pass through, storage paths get a temporary signed link.
 * Links are minted by a server function (see photo-signing.functions.ts), never by the
 * browser: public callers only get links for publicly visible listings, verified admins
 * also get links for drafts and other admin-only rows.
 */
export function usePhotoUrls(photos: string[] | null | undefined, isAdmin = false) {
  const list = photos ?? [];
  return useQuery({
    queryKey: ["photos", list, isAdmin],
    enabled: list.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const paths = list.filter((p) => !/^https?:\/\//.test(p));
      let signed: Record<string, string> = {};
      if (paths.length) {
        try {
          const result = isAdmin
            ? await signAdminPhotos({ data: { paths } })
            : await signPublicPhotos({ data: { paths } });
          signed = result.urlByPath;
        } catch (error) {
          console.warn("photo links unavailable", error);
        }
      }
      return list.map((p) => (/^https?:\/\//.test(p) ? p : signed[p])).filter(Boolean) as string[];
    },
  });
}

/**
 * Photo URLs for one row, gated on its visibility. Draft, demo and unpermitted rows get no
 * signed links unless an admin is previewing, so the app stops asking for photos it has no
 * right to show. See src/lib/photo-access.ts for what this does and does not guarantee.
 */
export function usePropertyPhotoUrls(row: (VisibilityInput & { photos: string[] | null }) | null | undefined) {
  const { session } = useSession();
  const { data: isAdmin } = useIsAdmin(session?.user.id);
  const allowed = row ? canSignPhotos(row, !!isAdmin) : false;
  const urls = usePhotoUrls(allowed ? row?.photos : []);
  return { ...urls, withheld: !!row && !allowed };
}
