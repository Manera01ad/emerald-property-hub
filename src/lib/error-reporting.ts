/**
 * Vendor-neutral runtime error reporting.
 *
 * There is no error-reporting vendor wired in, and there does not need to be:
 * `error-capture.ts` already records and expands errors for the server log, and
 * the browser's own console is the fallback. This module exists so a report has
 * one obvious place to go, and so swapping in Sentry (or anything else) later is
 * a change here rather than in every boundary.
 *
 * It deliberately does not send anything anywhere by default: a first-stage
 * product should not leak stack traces to a third party before the owner has
 * chosen a vendor and the privacy terms that go with it.
 */
type RuntimeErrorContext = Record<string, unknown>;

type RuntimeErrorHook = (error: unknown, context: RuntimeErrorContext) => void;

let hook: RuntimeErrorHook | undefined;

/** Install a reporting hook (for example, a Sentry adapter). Optional. */
export function setRuntimeErrorReporter(next: RuntimeErrorHook | undefined) {
  hook = next;
}

export function reportRuntimeError(error: unknown, context: RuntimeErrorContext = {}) {
  if (typeof window !== "undefined") {
    // The browser console is the only sink by default; the boundary already
    // shows the visitor a "try again" affordance, so nothing else is required.
    console.error(error, { route: window.location.pathname, ...context });
  }
  hook?.(error, context);
}
