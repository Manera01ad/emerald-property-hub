/**
 * Turning recorded assistant searches into a list of knowledge gaps.
 *
 * The directive asks for a private admin view of what people keep asking for and
 * not getting. The only honest input for that is what was actually recorded: the
 * assistant's search log, which holds a kind, a cleaned query, a result count and
 * a timestamp.
 *
 * Two things this module deliberately does not do.
 *
 * It does not read user identity. Gaps are aggregated across everyone, and the
 * output type has no user field, so a gap cannot be traced back to a person. The
 * tests assert that no identifier appears in the output.
 *
 * It does not invent a score. `priority` is a stated formula over occurrences and
 * empty results, and the panel shows the counts beside it. A made-up confidence
 * number would look authoritative and mean nothing.
 *
 * Pure: no I/O, no clock of its own, so it can be tested directly.
 */

export type SearchSignal = {
  kind: string;
  query: Record<string, unknown>;
  resultCount: number;
  createdAt: string;
};

export type GapEvidence = {
  occurrences: number;
  emptyResults: number;
  firstSeen: string;
  lastSeen: string;
  kinds: string[];
};

export type KnowledgeGap = {
  key: string;
  subject: string;
  area: string | null;
  evidence: GapEvidence;
  /** 0-100. See priorityOf for the formula. */
  priority: number;
  proposedSolution: string;
  /**
   * True when the counts are too low to act on. The panel must show this, because
   * a single search is not demand.
   */
  needsMoreEvidence: boolean;
};

/** A gap is worth showing after this many occurrences, or immediately if it returned nothing. */
export const MIN_OCCURRENCES = 3;

/** Occurrences at which priority reaches its maximum from frequency alone. */
const FREQUENCY_CEILING = 10;

const MAX_TERM_CHARS = 80;

/**
 * Normalises a query term for grouping: trimmed, collapsed, lowercased, and
 * limited in length. Returns null for anything that is not a usable string, so
 * odd values are dropped rather than grouped into a meaningless bucket.
 */
export function normaliseTerm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_TERM_CHARS);
  return cleaned.length ? cleaned : null;
}

/** The first usable term among the keys a query might use, in priority order. */
function firstTerm(query: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const term = normaliseTerm(query[key]);
    if (term) return term;
  }
  return null;
}

/** The locality a search named, if any. Used to group demand by area. */
export function areaOf(query: Record<string, unknown>): string | null {
  return firstTerm(query, ["area", "location", "locality", "city"]);
}

/**
 * A stable grouping key, or null when the signal carries nothing to group on.
 * Deliberately built from the search itself, never from who made it.
 */
export function gapKey(signal: SearchSignal): string | null {
  const area = areaOf(signal.query);
  if (signal.kind === "locality") {
    return area ? `locality:${area}` : null;
  }
  if (signal.kind === "listings") {
    const type = firstTerm(signal.query, ["property_type", "type"]);
    if (!area && !type) return null;
    return `listings:${area ?? "any"}:${type ?? "any"}`;
  }
  if (signal.kind === "web") {
    const text = firstTerm(signal.query, ["query", "q"]);
    return text ? `web:${text}` : null;
  }
  return null;
}

/** A readable subject for the panel. Describes the search, not the person. */
export function subjectOf(signal: SearchSignal): string {
  const area = areaOf(signal.query);
  if (signal.kind === "locality") return `Locality evidence: ${area ?? "unnamed area"}`;
  if (signal.kind === "listings") {
    const type = firstTerm(signal.query, ["property_type", "type"]);
    const where = area ?? "anywhere";
    return type ? `Listings: ${type} in ${where}` : `Listings in ${where}`;
  }
  if (signal.kind === "web") {
    const text = firstTerm(signal.query, ["query", "q"]);
    return `Web search: ${text ?? "unnamed"}`;
  }
  return `Search: ${signal.kind}`;
}

/**
 * Priority from 0 to 100.
 *
 * Two components, both from the recorded counts: how often the demand appeared
 * (up to 60) and how often it returned nothing (up to 40). A search that
 * repeatedly finds nothing is the strongest signal, because the visitor asked
 * and the platform could not answer.
 *
 * This is arithmetic, not a model. It is documented so the owner can change the
 * weights and see the effect.
 */
export function priorityOf(evidence: Pick<GapEvidence, "occurrences" | "emptyResults">): number {
  const frequency = Math.min(evidence.occurrences / FREQUENCY_CEILING, 1) * 60;
  const emptiness =
    evidence.occurrences > 0 ? (evidence.emptyResults / evidence.occurrences) * 40 : 0;
  return Math.round(frequency + emptiness);
}

/** A starting point for the owner to edit. Not a published commitment. */
export function proposedSolutionFor(gap: Pick<KnowledgeGap, "subject" | "area">): string {
  return gap.area
    ? `Review the evidence held for ${gap.area} and consider a research task covering it. ${gap.subject}.`
    : `Review whether existing capabilities answer this, then consider a research or data task. ${gap.subject}.`;
}

/**
 * Groups signals into gaps, strongest first.
 *
 * Signals that carry nothing to group on are skipped rather than lumped together,
 * because a bucket of unrelated searches would look like demand for something.
 */
export function collectGaps(signals: SearchSignal[]): KnowledgeGap[] {
  const groups = new Map<string, { subject: string; area: string | null; evidence: GapEvidence }>();

  for (const signal of signals) {
    const key = gapKey(signal);
    if (!key) continue;
    const existing = groups.get(key);
    const empty = signal.resultCount <= 0;
    if (!existing) {
      groups.set(key, {
        subject: subjectOf(signal),
        area: areaOf(signal.query),
        evidence: {
          occurrences: 1,
          emptyResults: empty ? 1 : 0,
          firstSeen: signal.createdAt,
          lastSeen: signal.createdAt,
          kinds: [signal.kind],
        },
      });
      continue;
    }
    existing.evidence.occurrences += 1;
    if (empty) existing.evidence.emptyResults += 1;
    if (signal.createdAt < existing.evidence.firstSeen)
      existing.evidence.firstSeen = signal.createdAt;
    if (signal.createdAt > existing.evidence.lastSeen)
      existing.evidence.lastSeen = signal.createdAt;
    if (!existing.evidence.kinds.includes(signal.kind)) existing.evidence.kinds.push(signal.kind);
  }

  const gaps: KnowledgeGap[] = [];
  for (const [key, group] of groups) {
    const { evidence } = group;
    // Show a gap if it returned nothing at all, or if it keeps happening.
    const worthShowing = evidence.emptyResults > 0 || evidence.occurrences >= MIN_OCCURRENCES;
    if (!worthShowing) continue;
    gaps.push({
      key,
      subject: group.subject,
      area: group.area,
      evidence,
      priority: priorityOf(evidence),
      proposedSolution: proposedSolutionFor(group),
      needsMoreEvidence: evidence.occurrences < MIN_OCCURRENCES,
    });
  }

  // Strongest first, then alphabetical so the order is stable between reads.
  return gaps.sort((a, b) => b.priority - a.priority || a.key.localeCompare(b.key));
}

/** A one-line summary for the panel header. */
export function summariseGaps(gaps: KnowledgeGap[]): string {
  if (!gaps.length) return "No gaps recorded yet.";
  const urgent = gaps.filter((g) => g.evidence.emptyResults > 0).length;
  return `${gaps.length} gap${gaps.length === 1 ? "" : "s"} recorded, ${urgent} of which returned no results at all.`;
}
