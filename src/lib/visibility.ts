/** Mirrors the public RLS rule: published AND listing_permission AND NOT is_demo. */
export type VisibilityInput = { status: string; is_demo: boolean; listing_permission: boolean };

export function hiddenReasons(p: VisibilityInput): string[] {
  const r: string[] = [];
  if (p.status !== "published") r.push(p.status === "archived" ? "Archived" : "Not published (draft)");
  if (!p.listing_permission) r.push("No owner/developer listing permission recorded");
  if (p.is_demo) r.push("Demo/test record — never public");
  return r;
}

export const isPubliclyVisible = (p: VisibilityInput) => hiddenReasons(p).length === 0;
