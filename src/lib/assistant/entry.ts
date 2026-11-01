import { MAX_MESSAGE_CHARS, checkMessage } from "./limits";

/**
 * The "Ask PropWise AI" box on the homepage is the primary way into the product, so it has to work
 * for a signed-out visitor too. The assistant itself needs a signed-in user, which means carrying the
 * question across a sign-in round trip.
 *
 * The plan is decided here, in pure code, so it can be tested without a browser: where to send the
 * visitor, and what to remember. The component only carries it out.
 */

export const ASSISTANT_PATH = "/assistant";
export const SIGN_IN_PATH = "/auth";

/** Where a question is parked while the visitor signs in. Read back, and cleared, exactly once. */
export const PENDING_QUESTION_KEY = "propwise:assistant:pending";

export type EntryPlan =
  | { kind: "ask"; to: string; question: string }
  | { kind: "sign-in"; to: string; next: string; store: { key: string; value: string } }
  | { kind: "problem"; message: string };

/**
 * Decides what the homepage box does with a question.
 *
 * A signed-in visitor goes straight to the assistant with the question in the address. A signed-out
 * visitor goes to sign in, and the question is parked in session storage because the sign-in redirect
 * cannot carry a query string through to the assistant. Either way the question survives.
 */
export function planAssistantEntry(question: string, signedIn: boolean): EntryPlan {
  const text = question.trim();
  if (!text) return { kind: "problem", message: "Please type a question." };

  const problem = checkMessage({ parts: [{ type: "text", text }] });
  if (problem) return { kind: "problem", message: problem };

  if (signedIn) return { kind: "ask", to: ASSISTANT_PATH, question: text };

  return {
    kind: "sign-in",
    to: SIGN_IN_PATH,
    next: ASSISTANT_PATH,
    store: { key: PENDING_QUESTION_KEY, value: text },
  };
}

type Storage = { getItem(key: string): string | null; removeItem(key: string): void };

/**
 * Reads the parked question and clears it, so a page reload or a second visit does not send it again.
 * Anything empty or over the message limit is discarded rather than sent.
 */
export function takePendingQuestion(storage: Storage): string | null {
  const value = storage.getItem(PENDING_QUESTION_KEY);
  if (value === null) return null;
  storage.removeItem(PENDING_QUESTION_KEY);
  const text = value.trim();
  if (!text || text.length > MAX_MESSAGE_CHARS) return null;
  return text;
}

/** The question from `?q=`, trimmed, or null. Untrusted input, so it is bounded and never thrown on. */
export function questionFromSearch(q: unknown): string | null {
  if (typeof q !== "string") return null;
  const text = q.trim();
  if (!text || text.length > MAX_MESSAGE_CHARS) return null;
  return text;
}
