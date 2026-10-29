/**
 * Pure health rules for the research pipeline.
 *
 * These back the dead-man's-switch: the pipeline writes a tick row on every run,
 * and this decides whether the gap between ticks is normal or alarming. Kept pure
 * so the rule is testable without a database.
 */

export type Tick = { started_at: string; finished_at: string | null; error: string | null };
export type AgentRow = { key: string; status: string; next_run_at: string | null; consecutive_failures: number; last_status: string | null };

/** The scheduler runs hourly, so a gap beyond this is treated as a missed run. */
export const EXPECTED_INTERVAL_MINUTES = 60;
export const STALE_AFTER_MINUTES = 2 * EXPECTED_INTERVAL_MINUTES;

export type Health = "ok" | "late" | "stalled" | "never_run";

const minutesBetween = (from: string, to: Date) => (to.getTime() - new Date(from).getTime()) / 60_000;

/**
 * The age of the most recent tick, and whether that age is acceptable. `now` is
 * injected so the rule can be tested at a fixed instant.
 */
export function pipelineHealth(ticks: readonly Tick[], now: Date = new Date()): { status: Health; lastTickAt: string | null; minutesSince: number | null } {
  const latest = [...ticks].sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  if (!latest) return { status: "never_run", lastTickAt: null, minutesSince: null };
  const minutesSince = minutesBetween(latest.started_at, now);
  if (minutesSince > STALE_AFTER_MINUTES) return { status: "stalled", lastTickAt: latest.started_at, minutesSince };
  if (minutesSince > EXPECTED_INTERVAL_MINUTES * 1.5) return { status: "late", lastTickAt: latest.started_at, minutesSince };
  return { status: "ok", lastTickAt: latest.started_at, minutesSince };
}

/** A tick that started but never finished is a run that died mid-flight. */
export function unfinishedTicks(ticks: readonly Tick[], now: Date = new Date()): Tick[] {
  return ticks.filter((t) => !t.finished_at && minutesBetween(t.started_at, now) > 10);
}

/**
 * Whether the pipeline needs a human. Any stalled pipeline, or any agent that has
 * failed repeatedly, is worth an alert. A single failure is normal and retried.
 */
export function needsAttention(ticks: readonly Tick[], agents: readonly AgentRow[], now: Date = new Date()): { alert: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const health = pipelineHealth(ticks, now);
  if (health.status === "never_run") reasons.push("The research pipeline has never run.");
  if (health.status === "stalled") reasons.push(`No research tick for ${Math.round(health.minutesSince ?? 0)} minutes (expected every ${EXPECTED_INTERVAL_MINUTES}).`);
  for (const t of unfinishedTicks(ticks, now)) reasons.push(`A tick started at ${t.started_at} never finished.`);
  for (const a of agents) {
    if (a.consecutive_failures >= 3) reasons.push(`Agent "${a.key}" has failed ${a.consecutive_failures} times in a row.`);
  }
  return { alert: reasons.length > 0, reasons };
}

/**
 * A run's stored status, corrected for the case where the engine caught an error
 * and stored `failed` while the in-memory result still said `success`. Reporting
 * must never call a failed run successful.
 */
export function reportedRunStatus(stored: string, error: string | null | undefined): "success" | "failed" | "skipped" {
  if (error) return "failed";
  if (stored === "skipped") return "skipped";
  return stored === "success" ? "success" : "failed";
}
