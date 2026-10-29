import { describe, expect, it } from "vitest";

import {
  answersNeeded,
  canSubmitFor,
  canSubmitToday,
  contributorStanding,
  DAILY_SUBMISSION_LIMIT,
  evidenceFieldLabel,
  evidenceForSubmission,
  isTaskOpen,
  nextSubmissionStatuses,
  pointsFor,
  POINTS_DISCLAIMER,
  requiresSource,
  taskProgress,
  validateSubmission,
  validateTask,
  type TaskDraft,
} from "./research-network";

const task: TaskDraft = {
  localitySlug: "tambaram",
  title: "Water supply timings in West Tambaram",
  ask: "How many hours a day does piped water reach homes in West Tambaram, and on which days?",
  evidenceField: "water_supply",
  expectedSource: "Chennai Metro Water office or a resident's meter reading log",
  difficulty: "moderate",
  requiredSubmissions: 2,
};

describe("task validation", () => {
  it("accepts a task that names its evidence field and source", () => {
    expect(validateTask(task)).toEqual({ ok: true });
  });

  it("refuses a task that does not say which field it produces evidence for", () => {
    const r = validateTask({ ...task, evidenceField: "vibes" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["evidenceField"]).toBeDefined();
  });

  it("refuses a task with no expected source, so opinion cannot be collected as fact", () => {
    const r = validateTask({ ...task, expectedSource: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["expectedSource"]).toBeDefined();
  });

  it("refuses a task too short to answer", () => {
    const r = validateTask({ ...task, ask: "Water?" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["ask"]).toBeDefined();
  });

  it("refuses an unreasonable number of answers", () => {
    expect(validateTask({ ...task, requiredSubmissions: 0 }).ok).toBe(false);
    expect(validateTask({ ...task, requiredSubmissions: 11 }).ok).toBe(false);
    expect(validateTask({ ...task, requiredSubmissions: 10 }).ok).toBe(true);
  });
});

describe("task points", () => {
  it("scales points with difficulty and how many answers are needed", () => {
    expect(pointsFor("easy")).toBe(10);
    expect(pointsFor("moderate")).toBe(25);
    expect(pointsFor("hard")).toBe(50);
    expect(pointsFor("hard", 3)).toBe(150);
  });

  it("caps the multiplier so a task cannot be worth an absurd number of points", () => {
    expect(pointsFor("hard", 100)).toBe(500);
  });
});

describe("task openness and progress", () => {
  it("treats an open task with no expiry as available", () => {
    expect(isTaskOpen({ status: "open" })).toBe(true);
  });

  it("hides a closed, cancelled or expired task", () => {
    expect(isTaskOpen({ status: "closed" })).toBe(false);
    expect(isTaskOpen({ status: "cancelled" })).toBe(false);
    expect(isTaskOpen({ status: "open", expires_at: "2020-01-01T00:00:00Z" })).toBe(false);
    expect(isTaskOpen({ status: "open", expires_at: "2099-01-01T00:00:00Z" })).toBe(true);
  });

  it("counts the answers still needed and says when a task is filled", () => {
    expect(answersNeeded({ required_submissions: 3, accepted_submissions: 1 })).toBe(2);
    expect(taskProgress({ required_submissions: 3, accepted_submissions: 1 }).label).toBe(
      "2 more answers needed",
    );
    expect(taskProgress({ required_submissions: 1, accepted_submissions: 1 }).done).toBe(true);
    expect(taskProgress({ required_submissions: 2, accepted_submissions: 1 }).label).toBe(
      "1 more answer needed",
    );
  });

  it("never reports a negative number of answers needed", () => {
    expect(answersNeeded({ required_submissions: 1, accepted_submissions: 5 })).toBe(0);
  });
});

describe("submission review", () => {
  it("mirrors the database transitions", () => {
    expect(nextSubmissionStatuses("submitted")).toEqual([
      "in_review",
      "accepted",
      "needs_changes",
      "rejected",
    ]);
    expect(nextSubmissionStatuses("in_review")).toEqual(["accepted", "needs_changes", "rejected"]);
    expect(nextSubmissionStatuses("needs_changes")).toEqual(["in_review", "rejected"]);
    expect(nextSubmissionStatuses("accepted")).toEqual([]);
    expect(nextSubmissionStatuses("rejected")).toEqual([]);
  });

  it("only lets an accepted submission count as evidence, and only as a claim", () => {
    expect(evidenceForSubmission("accepted")).toBe("CLAIM");
    expect(evidenceForSubmission("submitted")).toBe("UNKNOWN");
    expect(evidenceForSubmission("in_review")).toBe("UNKNOWN");
    expect(evidenceForSubmission("rejected")).toBe("UNKNOWN");
    expect(evidenceForSubmission("needs_changes")).toBe("UNKNOWN");
  });

  it("asks for a source only where a link is a reasonable expectation", () => {
    expect(requiresSource("flood_risk")).toBe(true);
    expect(requiresSource("civic_services")).toBe(true);
    expect(requiresSource("rent_range")).toBe(false);
    expect(requiresSource("occupancy")).toBe(false);
  });

  it("requires a source on a task that expects one", () => {
    const r = validateSubmission({
      body: "Water reaches about two hours a day in the morning.",
      sourceUrl: "",
      observedOn: "",
      evidenceField: "water_supply",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["sourceUrl"]).toBeDefined();
  });

  it("accepts a rent observation with no link, since it is an observation of asking rents", () => {
    const r = validateSubmission({
      body: "Two-bedroom flats here are being asked at about 18,000 a month.",
      sourceUrl: "",
      observedOn: "2026-03-01",
      evidenceField: "rent_range",
    });
    expect(r.ok).toBe(true);
  });

  it("refuses a source link that is not a web address", () => {
    const r = validateSubmission({
      body: "The road was re-laid last month along the full stretch.",
      sourceUrl: "see notice board",
      observedOn: "",
      evidenceField: "road_condition",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["sourceUrl"]).toBeDefined();
  });

  it("refuses an observation dated in the future", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const r = validateSubmission({
      body: "The drainage was cleared along the whole street.",
      sourceUrl: "https://example.com/x",
      observedOn: future,
      evidenceField: "drainage",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["observedOn"]).toBeDefined();
  });

  it("refuses an empty observation", () => {
    const r = validateSubmission({
      body: "too short",
      sourceUrl: "https://example.com",
      observedOn: "",
      evidenceField: "flood_risk",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors["body"]).toBeDefined();
  });
});

describe("contributors", () => {
  it("only lets an active contributor fill a task", () => {
    expect(canSubmitFor("active")).toBe(true);
    expect(canSubmitFor("pending")).toBe(false);
    expect(canSubmitFor("paused")).toBe(false);
    expect(canSubmitFor("removed")).toBe(false);
  });

  it("allows five submissions a day and refuses the sixth", () => {
    const now = new Date("2026-03-10T12:00:00Z");
    const five = Array.from(
      { length: DAILY_SUBMISSION_LIMIT },
      (_, i) => `2026-03-10T0${i + 1}:00:00Z`,
    );
    expect(canSubmitToday(five, now)).toBe(false);
    expect(canSubmitToday(five.slice(0, 4), now)).toBe(true);
    expect(canSubmitToday(["2026-03-08T08:00:00Z"], now)).toBe(true);
  });

  it("describes standing without exposing a public score", () => {
    expect(contributorStanding(0, 0)).toBe("No contributions reviewed yet");
    expect(contributorStanding(1, 0)).toBe("New contributor");
    expect(contributorStanding(6, 1)).toBe("Established contributor");
    expect(contributorStanding(25, 2)).toBe("Trusted local contributor");
    expect(contributorStanding(1, 4)).toBe("More contributions rejected than accepted");
  });

  it("states plainly that points are not money", () => {
    expect(POINTS_DISCLAIMER).toMatch(/not money/i);
    expect(POINTS_DISCLAIMER).toMatch(/no advantage/i);
  });

  it("labels evidence fields and falls back safely", () => {
    expect(evidenceFieldLabel("water_supply")).toBe("Water supply");
    expect(evidenceFieldLabel("nonsense")).toBe("Not recorded");
    expect(evidenceFieldLabel(null)).toBe("Not recorded");
  });
});
