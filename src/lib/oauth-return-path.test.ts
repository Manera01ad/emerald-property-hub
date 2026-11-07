import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { oauthReturnPath } from "./oauth-return-path";

/**
 * Regression guard for the sign-in return path.
 *
 * The `/auth` page reads a `?next=` parameter, keeps it through sign-in and
 * navigates there afterwards (`src/routes/auth.tsx`). Because `next` is
 * attacker-controllable — anyone can send a link to `/auth?next=…` — the value
 * must be reduced to a path on this site before it is used. If a `//host` or an
 * absolute URL were allowed through, the OAuth flow would return the freshly
 * signed-in visitor to an attacker's origin, with the account context fresh in
 * mind: a classic open redirect on the authentication boundary.
 *
 * `oauthReturnPath` is that reduction. It had no test, so nothing stopped a
 * future edit from loosening it. These cases pin the decision itself.
 */

const ORIGIN = "https://app.invalid";

/** True when the returned value could send a browser away from this site. */
function leavesOrigin(result: string): boolean {
  if (!result.startsWith("/") || result.startsWith("//")) return true;
  try {
    return new URL(result, ORIGIN).origin !== ORIGIN;
  } catch {
    return true;
  }
}

describe("oauth return path", () => {
  it("keeps a plain in-app path", () => {
    expect(oauthReturnPath("/my")).toBe("/my");
    expect(oauthReturnPath("/admin")).toBe("/admin");
    expect(oauthReturnPath("/properties/123")).toBe("/properties/123");
  });

  it("keeps query strings and fragments on an in-app path", () => {
    expect(oauthReturnPath("/my?tab=reports")).toBe("/my?tab=reports");
    expect(oauthReturnPath("/properties?transaction=lease#results")).toBe(
      "/properties?transaction=lease#results",
    );
  });

  it("refuses an absolute URL to another host", () => {
    expect(oauthReturnPath("https://evil.example/phish")).toBe("/");
    expect(oauthReturnPath("http://evil.example")).toBe("/");
    expect(oauthReturnPath("javascript:alert(1)")).toBe("/");
  });

  it("refuses protocol-relative and triple-slash values", () => {
    // "//host" is read as a scheme-relative URL by the browser: an open redirect.
    expect(oauthReturnPath("//evil.example")).toBe("/");
    expect(oauthReturnPath("//evil.example/x")).toBe("/");
    expect(oauthReturnPath("///evil.example")).toBe("/");
  });

  it("refuses a backslash used to smuggle a host", () => {
    // Browsers normalise "\" to "/" in URLs, so "/\evil.example" is "//evil.example".
    expect(oauthReturnPath("/\\evil.example")).toBe("/");
  });

  it("refuses control characters and whitespace that could break the header/path", () => {
    expect(oauthReturnPath("/\tevil")).toBe("/");
    expect(oauthReturnPath("/\nevil")).toBe("/");
    expect(oauthReturnPath("\u0000evil")).toBe("/");
  });

  it("refuses a dot-segment climb that resolves to another host", () => {
    expect(oauthReturnPath("/..//evil.example")).toBe("/");
  });

  it("refuses values that are not strings at all", () => {
    expect(oauthReturnPath(undefined)).toBe("/");
    expect(oauthReturnPath(null)).toBe("/");
    expect(oauthReturnPath(42)).toBe("/");
    expect(oauthReturnPath({ toString: () => "https://evil.example" })).toBe("/");
    expect(oauthReturnPath("")).toBe("/");
    expect(oauthReturnPath("my")).toBe("/");
  });

  it("normalises a relative path rather than trusting it verbatim", () => {
    expect(oauthReturnPath("/./my")).toBe("/my");
    expect(oauthReturnPath("/path with space")).toBe("/path%20with%20space");
  });

  it("never returns a value that leaves this origin, for any input", () => {
    const inputs = [
      "/my",
      "/my?tab=reports#x",
      "//evil.example",
      "///evil.example",
      "https://evil.example",
      "http://evil.example",
      "/\\evil.example",
      "/%2F%2Fevil.example",
      "/%5Cevil.example",
      "/..//evil.example",
      "/./my",
      "/\tevil",
      "/\u007f",
      "\u0000",
      "",
      "my",
      "?next=//evil.example",
      "javascript:alert(1)",
    ];
    for (const input of inputs) {
      expect(leavesOrigin(oauthReturnPath(input)), `input ${JSON.stringify(input)}`).toBe(false);
    }
  });

  it("is the guard the sign-in page actually applies to ?next=", () => {
    // Ties the pure rule to the flow that uses it: if auth.tsx stopped routing
    // `next` through this function, the redirect would be unchecked again.
    const src = readFileSync(resolve(process.cwd(), "src/routes/auth.tsx"), "utf8");
    expect(src).toContain('from "@/lib/oauth-return-path"');
    expect(src).toContain("oauthReturnPath(rawNext)");
  });
});
