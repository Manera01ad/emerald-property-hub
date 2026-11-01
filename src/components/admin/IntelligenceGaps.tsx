/**
 * The Intelligence Gap Dashboard.
 *
 * Shows what people searched for and did not get, so the owner can decide what
 * to research or build next. Private: admin-only, reached through a server
 * function, and aggregated so no individual's history is on screen.
 *
 * The panel is explicit about weak evidence. A gap seen once is shown as needing
 * more evidence rather than presented as demand, because acting on a single
 * search would be reading a coincidence as a trend.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Panel, Stat } from "./shared";
import { MIN_OCCURRENCES } from "@/lib/intelligence-gaps";
import { getIntelligenceGaps } from "@/lib/intelligence-gaps.functions";

function shortDate(value: string) {
  return value.slice(0, 10);
}

export function IntelligenceGaps() {
  const load = useServerFn(getIntelligenceGaps);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "intelligence-gaps"],
    queryFn: () => load({ data: undefined as never }),
    retry: false,
  });

  if (isPending) return <Panel>Loading knowledge gaps…</Panel>;
  if (isError) {
    return (
      <Panel>
        <p className="font-medium text-destructive">Could not load knowledge gaps</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
      </Panel>
    );
  }

  if (data.readFailed) {
    return (
      <Panel>
        <p className="font-medium text-destructive">The search log could not be read</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This is not the same as having no gaps. Nothing is shown because nothing could be read.
        </p>
      </Panel>
    );
  }

  const { gaps, summary, signalsRead } = data;
  const noResults = gaps.filter((g) => g.evidence.emptyResults > 0).length;
  const weak = gaps.filter((g) => g.needsMoreEvidence).length;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gaps recorded" value={gaps.length} sub={summary} />
        <Stat label="Returned nothing" value={noResults} sub="asked and unanswered" />
        <Stat
          label="Thin evidence"
          value={weak}
          sub={`fewer than ${MIN_OCCURRENCES} occurrences`}
        />
        <Stat label="Signals read" value={signalsRead} sub="last 30 days, anonymous" />
      </div>

      <Panel>
        <p className="font-medium">What people asked for and did not get</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Aggregated across all users. No individual's searches are shown. Priority is a stated
          formula over how often the demand appeared and how often it returned nothing.
        </p>

        {gaps.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No gaps recorded yet. This is expected on a new site with little traffic.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {gaps.map((gap) => (
              <div key={gap.key} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{gap.subject}</p>
                  <div className="flex items-center gap-2">
                    {gap.needsMoreEvidence && (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning">
                        Thin evidence
                      </span>
                    )}
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      Priority {gap.priority}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{gap.proposedSolution}</p>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1">
                    <dt>Occurrences:</dt>
                    <dd className="font-medium">{gap.evidence.occurrences}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Returned nothing:</dt>
                    <dd className="font-medium">{gap.evidence.emptyResults}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>First seen:</dt>
                    <dd className="font-medium">{shortDate(gap.evidence.firstSeen)}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>Last seen:</dt>
                    <dd className="font-medium">{shortDate(gap.evidence.lastSeen)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel>
        <p className="font-medium">What this panel does not do</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            It does not create skills, tasks or challenges. The owner decides, and reviews any
            change.
          </li>
          <li>It does not identify who asked. The aggregation has no user field.</li>
          <li>
            It does not judge whether a gap is worth filling. The counts are shown so you can.
          </li>
        </ul>
      </Panel>
    </div>
  );
}
