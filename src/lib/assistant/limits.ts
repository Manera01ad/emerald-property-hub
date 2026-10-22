/** Cost guards for the public assistant: every message spends Lovable AI credits, so each user gets a small daily allowance. */
export const DAILY_MESSAGE_LIMIT = 15;
export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY_MESSAGES = 20;
export const WINDOW_MS = 24 * 60 * 60 * 1000;

type Part = { type?: string; text?: string };

export function messageText(m: { parts?: Part[] }): string {
  return (m.parts ?? []).filter((p) => p.type === "text").map((p) => p.text ?? "").join("");
}

/** Returns a user-facing problem with the message, or null if it is acceptable. */
export function checkMessage(m: { parts?: Part[] }): string | null {
  const text = messageText(m).trim();
  if (!text) return "Please type a question.";
  if (text.length > MAX_MESSAGE_CHARS) return `Please keep your question under ${MAX_MESSAGE_CHARS.toLocaleString("en-IN")} characters.`;
  return null;
}

export function windowStart(now: number = Date.now()): string {
  return new Date(now - WINDOW_MS).toISOString();
}

export const LIMIT_REACHED_MESSAGE = `You've reached today's limit of ${DAILY_MESSAGE_LIMIT} questions. Please try again tomorrow, or book a consultation for personal help.`;
export const UNAVAILABLE_MESSAGE = "The assistant is unavailable right now. Please try again later or use the Consult page.";
