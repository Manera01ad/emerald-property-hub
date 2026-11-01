/**
 * AI spend and the daily cap, for the admin control centre.
 *
 * The figures come from an admin-only server function, so raw cost rows never
 * reach the browser and the admin check cannot be bypassed by the client.
 *
 * The state that matters most is the one where the migration has not been
 * applied: `enforcementAvailable` is false and the panel says plainly that
 * spending cannot be measured, which is also why the assistant is refusing paid
 * calls. Showing zeros instead would read as "nothing spent".
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Panel, Stat } from "./shared";
import { formatINR, formatINRFull } from "@/lib/format";
import { getAiCostReport } from "@/lib/ai-costs.functions";

export function AiCosts() {
  const load = useServerFn(getAiCostReport);
  const { data, isPending, isError, error } = useQuery({
    queryKey: ["admin", "ai-costs"],
    queryFn: () => load({ data: undefined as never }),
    retry: false,
  });

  if (isPending) return <Panel>Loading AI costs…</Panel>;
  if (isError) {
    return (
      <Panel>
        <p className="font-medium text-destructive">Could not read AI costs</p>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
      </Panel>
    );
  }

  if (!data.enforcementAvailable) {
    return (
      <Panel>
        <p className="font-medium text-destructive">AI cost control is not active</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The usage tables are missing, so spending cannot be measured or capped. The assistant is
          refusing paid requests rather than spending without a limit, and visitors see a temporary
          unavailable message.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          To activate it, apply{" "}
          <code className="rounded bg-muted px-1">drizzle/pending/0021_ai_cost_control.sql</code>.
          Until then no AI cost is recorded.
        </p>
      </Panel>
    );
  }

  const { summary, configuredBudgetInr, recent } = data;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Spent today (UTC)"
          value={formatINR(summary.spentInr)}
          sub={`of ${formatINRFull(configuredBudgetInr)} cap`}
        />
        <Stat
          label="Reserved, in flight"
          value={formatINR(summary.reservedInr)}
          sub="not yet reconciled"
        />
        <Stat label="Calls today" value={summary.calls} />
        <Stat
          label="Estimated, not measured"
          value={summary.estimated}
          sub={summary.estimated ? "provider omitted usage" : "all measured"}
        />
      </div>

      {summary.unpriced > 0 && (
        <Panel>
          <p className="font-medium text-destructive">
            {summary.unpriced} call(s) with no configured price
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            These spent real money but recorded no cost, because the model is not in the price table
            in <code className="rounded bg-muted px-1">src/lib/assistant/pricing.ts</code>. Add the
            rate so the spend counts against the cap.
          </p>
        </Panel>
      )}

      <Panel>
        <p className="font-medium">Recent calls</p>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No paid calls recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-1 pr-4">When (UTC)</th>
                  <th className="py-1 pr-4">Model</th>
                  <th className="py-1 pr-4">Cost</th>
                  <th className="py-1">Source</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row, index) => (
                  <tr key={index} className="border-t">
                    <td className="py-1 pr-4">{row.created_at.replace("T", " ").slice(0, 19)}</td>
                    <td className="py-1 pr-4">{row.model}</td>
                    <td className="py-1 pr-4">
                      {row.cost_inr === null ? "unknown" : formatINRFull(Number(row.cost_inr))}
                    </td>
                    <td className="py-1">{row.cost_measured ? "measured" : "estimated"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
