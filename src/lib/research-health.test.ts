import { describe, expect, it } from "vitest";
import { EXPECTED_INTERVAL_MINUTES, STALE_AFTER_MINUTES, needsAttention, pipelineHealth, reportedRunStatus, unfinishedTicks, type AgentRow, type Tick } from "./research-health";

const NOW = new Date("2026-10-29T12:00:00.000Z");
const at = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString();
const tick = (minutesAgo: number, finished = true): Tick => ({ started_at: at(minutesAgo), finished_at: finished ? at(minutesAgo) : null, error: null });

describe("pipelineHealth", () => {
  it("is ok when the last tick is within the expected interval", () => {
    expect(pipelineHealth([tick(10)], NOW).status).toBe("ok");
    expect(pipelineHealth([tick(50)], NOW).status).toBe("ok");
  });

  it("is late when the last tick is overdue but not stalled", () => {
    expect(pipelineHealth([tick(100)], NOW).status).toBe("late");
  });

  it("is stalled when the last tick is older than the stale threshold", () => {
    const h = pipelineHealth([tick(STALE_AFTER_MINUTES + 1)], NOW);
    expect(h.status).toBe("stalled");
    expect(h.minutesSince).toBeGreaterThan(STALE_AFTER_MINUTES);
  });

  it("is never_run when there are no ticks", () => {
    expect(pipelineHealth([], NOW)).toEqual({ status: "never_run", lastTickAt: null, minutesSince: null });
  });

  it("uses the most recent tick regardless of input order", () => {
    const h = pipelineHealth([tick(500), tick(5), tick(200)], NOW);
    expect(h.status).toBe("ok");
    expect(h.minutesSince).toBeCloseTo(5, 5);
  });

  it("keeps the thresholds consistent with an hourly schedule", () => {
    expect(EXPECTED_INTERVAL_MINUTES).toBe(60);
    expect(STALE_AFTER_MINUTES).toBe(120);
  });
});

describe("unfinishedTicks", () => {
  it("flags a tick that started long ago and never finished", () => {
    expect(unfinishedTicks([tick(30, false)], NOW)).toHaveLength(1);
  });

  it("does not flag a run that is still in flight", () => {
    expect(unfinishedTicks([tick(2, false)], NOW)).toHaveLength(0);
  });

  it("does not flag a completed run", () => {
    expect(unfinishedTicks([tick(30, true)], NOW)).toHaveLength(0);
  });
});

describe("needsAttention", () => {
  const healthyAgent: AgentRow = { key: "discovery", status: "active", next_run_at: at(-60), consecutive_failures: 0, last_status: "success" };

  it("does not alert for a healthy pipeline", () => {
    expect(needsAttention([tick(10)], [healthyAgent], NOW)).toEqual({ alert: false, reasons: [] });
  });

  it("alerts when the pipeline has never run", () => {
    expect(needsAttention([], [], NOW).reasons.join(" ")).toMatch(/never run/i);
  });

  it("alerts when the pipeline is stalled", () => {
    expect(needsAttention([tick(STALE_AFTER_MINUTES + 30)], [healthyAgent], NOW).alert).toBe(true);
  });

  it("alerts when an agent keeps failing", () => {
    const failing: AgentRow = { ...healthyAgent, consecutive_failures: 3, last_status: "failed" };
    const r = needsAttention([tick(10)], [failing], NOW);
    expect(r.alert).toBe(true);
    expect(r.reasons.join(" ")).toMatch(/discovery/);
  });

  it("tolerates a single failure, because it is retried", () => {
    expect(needsAttention([tick(10)], [{ ...healthyAgent, consecutive_failures: 1 }], NOW).alert).toBe(false);
  });

  it("alerts when a tick never finished", () => {
    expect(needsAttention([tick(40, false)], [healthyAgent], NOW).alert).toBe(true);
  });
});

describe("reportedRunStatus", () => {
  it("reports failed when an error was recorded, even if the stored status says success", () => {
    expect(reportedRunStatus("success", "Source returned 503")).toBe("failed");
  });

  it("reports the stored status when there is no error", () => {
    expect(reportedRunStatus("success", null)).toBe("success");
    expect(reportedRunStatus("skipped", null)).toBe("skipped");
    expect(reportedRunStatus("failed", null)).toBe("failed");
  });

  it("never reports an unknown stored status as success", () => {
    expect(reportedRunStatus("running", null)).toBe("failed");
  });
});
