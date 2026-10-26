/** Pure helpers for the assistant's search history. No I/O here, so they are easy to test. */

export type SearchKind = "listings" | "listing" | "web";

export type SearchSource = { title?: string; url?: string; id?: string };

export type SearchLogRow = {
  user_id: string;
  message_id: string;
  kind: SearchKind;
  query: Record<string, unknown>;
  result_count: number;
  sources: SearchSource[];
};

const MAX_QUERY_VALUE_CHARS = 200;
const MAX_SOURCES = 20;

/** Keeps only simple, short values from a tool input so the log never stores large or odd payloads. */
export function cleanQuery(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value.slice(0, MAX_QUERY_VALUE_CHARS);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
  }
  return out;
}

/** Only http(s) links are kept as sources; anything else is dropped. */
export function cleanSources(sources: SearchSource[]): SearchSource[] {
  const out: SearchSource[] = [];
  for (const s of sources) {
    if (out.length >= MAX_SOURCES) break;
    const clean: SearchSource = {};
    if (s.title) clean.title = s.title.slice(0, MAX_QUERY_VALUE_CHARS);
    if (s.id) clean.id = s.id.slice(0, 64);
    if (s.url) {
      try {
        const u = new URL(s.url);
        if (u.protocol === "https:" || u.protocol === "http:") clean.url = u.toString();
      } catch {
        // not a valid URL; skip it
      }
    }
    if (clean.url || clean.id) out.push(clean);
  }
  return out;
}

export function buildLogRow(args: {
  userId: string;
  messageId: string;
  kind: SearchKind;
  input: unknown;
  resultCount: number;
  sources: SearchSource[];
}): SearchLogRow {
  return {
    user_id: args.userId,
    message_id: args.messageId,
    kind: args.kind,
    query: cleanQuery(args.input),
    result_count: Math.max(0, Math.floor(args.resultCount)),
    sources: cleanSources(args.sources),
  };
}

/** One readable line for the history list, e.g. "Listings: Velachery, apartment, up to ₹8,000,000". */
export function describeSearch(row: { kind: SearchKind; query: Record<string, unknown> }): string {
  const q = row.query;
  if (row.kind === "web") return `Web: ${String(q["query"] ?? q["q"] ?? "web search")}`;
  if (row.kind === "listing") return "Opened one listing";
  const parts: string[] = [];
  if (q["location"]) parts.push(String(q["location"]));
  if (q["property_type"]) parts.push(String(q["property_type"]));
  if (typeof q["max_price"] === "number") parts.push(`up to ₹${q["max_price"].toLocaleString("en-IN")}`);
  return `Listings: ${parts.length ? parts.join(", ") : "all public listings"}`;
}
