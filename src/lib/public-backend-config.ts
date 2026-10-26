import { createServerFn } from "@tanstack/react-start";

// Only this public pair may cross the server/browser boundary.
export type PublicBackendConfig = { url: string; publishableKey: string };
let browserConfig: PublicBackendConfig | undefined;

export function setBrowserBackendConfig(config: PublicBackendConfig) {
  if (typeof window !== "undefined") browserConfig = config;
}

export function getBrowserBackendConfig() {
  return browserConfig;
}

export const getPublicBackendConfig = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env["VITE_SUPABASE_URL"] || process.env["SUPABASE_URL"] || "";
  const publishableKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"] || "";
  // Never serialize a privileged key, even if deployment bindings are misconfigured.
  if (!url || !publishableKey.startsWith("sb_publishable_")) {
    throw new Error("Public backend configuration is missing or invalid.");
  }
  return { url, publishableKey };
});
