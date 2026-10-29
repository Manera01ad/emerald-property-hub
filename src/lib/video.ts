/**
 * YouTube link handling for the video-first property experience.
 *
 * Pure functions only: no network, no DOM. A video is only ever shown from an
 * explicit, validated link that an admin pasted — nothing is scraped.
 */

/** YouTube ids are exactly 11 characters of this alphabet. */
const ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Returns the 11-character video id for a YouTube watch, short or embed link,
 * or for a bare id. Returns null for anything else, including other hosts.
 */
export function youTubeId(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  if (ID.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  const segments = url.pathname.split("/").filter(Boolean);
  const pick = (value: string | null | undefined) => (value && ID.test(value) ? value : null);

  if (host === "youtu.be") return pick(segments[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (segments[0] === "watch") return pick(url.searchParams.get("v"));
    if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live" || segments[0] === "v") {
      return pick(segments[1]);
    }
  }
  return null;
}

/**
 * Privacy-enhanced embed URL. Uses youtube-nocookie.com so no tracking cookie is
 * set until the visitor actually plays the video.
 */
export function youTubeEmbedUrl(input: string | null | undefined): string | null {
  const id = youTubeId(input);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

/** Thumbnail URL, used for the click-to-play poster so no iframe loads up front. */
export function youTubeThumbnailUrl(input: string | null | undefined): string | null {
  const id = youTubeId(input);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * Maps a stored list of links to usable video entries, dropping anything that is
 * not a valid YouTube link. Order is preserved and duplicates are removed.
 */
export function propertyVideos(links: readonly string[] | null | undefined): { id: string; embedUrl: string; thumbnailUrl: string }[] {
  const seen = new Set<string>();
  const out: { id: string; embedUrl: string; thumbnailUrl: string }[] = [];
  for (const link of links ?? []) {
    const id = youTubeId(link);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    });
  }
  return out;
}
