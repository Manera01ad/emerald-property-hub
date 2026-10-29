/** Phase 1 feature flags. Stored in app_settings as 'on' / 'off' and read through RLS. */
export const FLAG_KEYS = ["feature_community", "feature_owner_submissions", "feature_interest_requests"] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/** Only the exact value 'on' enables a feature; anything else, including missing, stays off. */
export function parseFlag(value: string | undefined | null): boolean {
  return value === "on";
}

export const FLAG_LABELS: Record<FlagKey, string> = {
  feature_community: "Community (threads and posts)",
  feature_owner_submissions: "Owner listing submissions",
  feature_interest_requests: "Interest requests on approved listings",
};
