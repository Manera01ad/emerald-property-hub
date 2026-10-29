import { isPubliclyVisible, type VisibilityInput } from "./visibility";

/**
 * Photo-access finding: listing photos live in a private bucket and the browser asks for a
 * short-lived signed link for each path. Nothing in the browser stopped a signed link being
 * minted for a draft, a demo row or an unpermitted row — the picture was reachable even
 * though the listing itself was not public.
 *
 * This decides, per row, whether the browser may ask for those links at all:
 *   * a publicly visible row (published AND listing_permission AND NOT is_demo) — yes;
 *   * anything else — only for a signed-in admin, who needs it to preview a draft.
 *
 * This is a client-side gate, not a security boundary. It stops the app from asking for
 * draft photos in normal use, but the bucket's own access rules are what actually protect
 * the files, and those are owner-only to change (see the repository rules on privileged
 * signing). Treat this as a defence in depth layer, not as the fix by itself.
 */
export function canSignPhotos(row: VisibilityInput, isAdmin: boolean): boolean {
  return isAdmin || isPubliclyVisible(row);
}

/** True when we must refuse to sign, so callers can show a placeholder rather than a broken image. */
export function photosWithheld(row: VisibilityInput, isAdmin: boolean): boolean {
  return !canSignPhotos(row, isAdmin);
}
