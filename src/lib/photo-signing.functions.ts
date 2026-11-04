/**
 * Server-side signing of property-photo links.
 *
 * Why the signing moved here: the previous storage rule let any signed-in user
 * download every photo in the private bucket as long as it belonged to a visible
 * listing — the security scanner flagged it, and rightly so. Now nothing in the
 * browser can mint a link at all. The server signs a path only when:
 *   * public mode — the path belongs to a listing that is publicly visible
 *     (published AND listing permission recorded AND not a demo record); or
 *   * admin mode — the caller is a verified admin, who needs links to preview
 *     drafts, demo and unpermitted rows in the admin screens.
 *
 * The admin client is loaded inside the handler so it never enters the browser
 * bundle, and the caller's identity is verified before any privileged work.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PhotoMode = "public" | "admin";

const MAX_PATHS = 100;

const inputSchema = z.object({
  paths: z.array(z.string().min(1).max(300)).max(MAX_PATHS),
});

/** A path is a bare object name inside the private bucket: no slashes at the start, no traversal. */
function safePath(p: string): boolean {
  return p.length > 0 && !p.startsWith("/") && !p.includes("..") && !p.includes("//");
}

export type SignedPhotos = { urlByPath: Record<string, string> };

/** Public mode: sign only photos of publicly visible listings. No sign-in required. */
export const signPublicPhotos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<SignedPhotos> => {
    const paths = [...new Set(data.paths.filter(safePath))];
    if (!paths.length) return { urlByPath: {} };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The visibility filter here mirrors the public listing rule; the browser never
    // decides this — the server re-checks every path against the live rows.
    const { data: rows, error } = await supabaseAdmin
      .from("properties")
      .select("photos")
      .eq("status", "published")
      .eq("listing_permission", true)
      .eq("is_demo", false);
    if (error) throw new Error("Could not verify which listings are publicly visible");

    const allowed = new Set<string>();
    for (const row of rows ?? []) {
      for (const photo of (row.photos as string[] | null) ?? []) if (safePath(photo)) allowed.add(photo);
    }
    return sign(paths.filter((p) => allowed.has(p)));
  });

/** Admin mode: verified admins may preview photos of any listing, drafts included. */
export const signAdminPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data, context }): Promise<SignedPhotos> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Admins only");

    const paths = [...new Set(data.paths.filter(safePath))];
    return sign(paths);
  });

async function sign(paths: string[]): Promise<SignedPhotos> {
  if (!paths.length) return { urlByPath: {} };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from("property-photos")
    .createSignedUrls(paths, 3600);
  if (error) throw new Error("Could not create photo links");
  const urlByPath: Record<string, string> = {};
  for (const item of data ?? []) if (item.path && item.signedUrl) urlByPath[item.path] = item.signedUrl;
  return { urlByPath };
}
