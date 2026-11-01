import { z } from "zod";

/**
 * Search-parameter schemas that never throw.
 *
 * A query string is untrusted input, and TanStack Router parses it with its own
 * rules before `validateSearch` runs: `?area=123` arrives as the number 123, and
 * `?allInclusive=true` as the boolean true. A plain `z.string()` or `z.number()`
 * rejects those shapes, `validateSearch` throws, and because the search is parsed
 * during server-side rendering the whole route answers 500 — a broken page for a
 * visitor who merely mistyped or hand-edited the address.
 *
 * Every field below therefore falls back to `undefined` (meaning "no filter")
 * instead of raising, so a malformed or unexpected parameter is ignored while a
 * well-formed one is still applied.
 */

/** A text parameter. A non-string value (e.g. a number from `?area=123`) is ignored. */
export const searchString = z.string().optional().catch(undefined);

/** A numeric parameter. Accepts "50" or 50; blank, non-numeric or infinite values are ignored. */
export const searchNumber = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().finite(),
  )
  .optional()
  .catch(undefined);

/** A whole-number parameter. Fractional, blank or non-numeric values are ignored. */
export const searchInt = z
  .preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.coerce.number().int().finite(),
  )
  .optional()
  .catch(undefined);

/** A checkbox-style parameter. Accepts true/false and the string forms "true"/"false"/"1"/"0". */
export const searchBoolean = z
  .preprocess((value) => {
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    return undefined;
  }, z.boolean())
  .optional()
  .catch(undefined);

/** A parameter constrained to a fixed set of words; anything else is ignored. */
export const searchEnum = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).optional().catch(undefined);
