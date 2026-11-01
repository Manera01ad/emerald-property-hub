import { describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_PATH,
  PENDING_QUESTION_KEY,
  SIGN_IN_PATH,
  planAssistantEntry,
  questionFromSearch,
  takePendingQuestion,
} from "./entry";
import { MAX_MESSAGE_CHARS } from "./limits";

describe("planAssistantEntry", () => {
  it("sends a signed-in visitor straight to the assistant with the question", () => {
    expect(planAssistantEntry("  What is Guduvancheri like?  ", true)).toEqual({
      kind: "ask",
      to: ASSISTANT_PATH,
      question: "What is Guduvancheri like?",
    });
  });

  it("sends a signed-out visitor to sign in and parks the question", () => {
    expect(planAssistantEntry("Compare two plots", false)).toEqual({
      kind: "sign-in",
      to: SIGN_IN_PATH,
      next: ASSISTANT_PATH,
      store: { key: PENDING_QUESTION_KEY, value: "Compare two plots" },
    });
  });

  it("refuses an empty question", () => {
    const plan = planAssistantEntry("   ", true);
    expect(plan.kind).toBe("problem");
  });

  it("refuses a question that is too long", () => {
    const plan = planAssistantEntry("x".repeat(MAX_MESSAGE_CHARS + 1), true);
    expect(plan).toEqual({ kind: "problem", message: expect.stringMatching(/under/) });
  });
});

describe("takePendingQuestion", () => {
  const storage = (value: string | null) => {
    const removeItem = vi.fn();
    return { getItem: () => value, removeItem, removeItemSpy: removeItem };
  };

  it("returns the question and clears it", () => {
    const s = storage("  Where is the water table high?  ");
    expect(takePendingQuestion(s)).toBe("Where is the water table high?");
    expect(s.removeItemSpy).toHaveBeenCalledWith(PENDING_QUESTION_KEY);
  });

  it("returns null when nothing is parked, and does not clear", () => {
    const s = storage(null);
    expect(takePendingQuestion(s)).toBeNull();
    expect(s.removeItemSpy).not.toHaveBeenCalled();
  });

  it("discards a blank or over-long parked value", () => {
    expect(takePendingQuestion(storage("   "))).toBeNull();
    expect(takePendingQuestion(storage("y".repeat(MAX_MESSAGE_CHARS + 1)))).toBeNull();
  });
});

describe("questionFromSearch", () => {
  it("reads a bounded question and rejects anything else", () => {
    expect(questionFromSearch("  rent in Potheri  ")).toBe("rent in Potheri");
    expect(questionFromSearch("")).toBeNull();
    expect(questionFromSearch(undefined)).toBeNull();
    expect(questionFromSearch(42)).toBeNull();
    expect(questionFromSearch("z".repeat(MAX_MESSAGE_CHARS + 1))).toBeNull();
  });
});
