/**
 * Shared route list and helpers for the browser guards.
 *
 * Kept in one place so a new route is covered by every check by adding it here.
 * Routes that only redirect are deliberately excluded.
 */
export const ROUTES = [
  "/",
  "/properties",
  "/explore",
  "/compare",
  "/location-intelligence",
  "/community",
  "/research-services",
  "/owners",
  "/auth",
  "/consult",
  "/contact",
  "/infrastructure",
  "/map",
  "/privacy",
  "/terms",
  "/disclaimer",
] as const;

/** The three widths the product is designed for: phone, tablet, desktop. */
export const VIEWPORTS = [
  { name: "mobile", width: 375, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

/** Roles whose computed accessible name must never be empty. */
export const NAMED_ROLES = new Set([
  "combobox",
  "textbox",
  "spinbutton",
  "checkbox",
  "radio",
  "button",
  "searchbox",
  "listbox",
  "slider",
  "switch",
]);

/**
 * Controls whose computed accessible name is empty, read from the browser's own
 * accessibility tree rather than inferred from the DOM.
 *
 * A DOM heuristic gets this wrong: it misses names inherited from a wrapping
 * <label>, and it flags checkboxes that are in fact correctly named. The tree is
 * the authoritative answer to what a screen reader announces.
 */
export async function controlsWithNoName(page: import("@playwright/test").Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Accessibility.enable");
  const tree = await session.send("Accessibility.getFullAXTree");

  const unnamed: { role: string; html: string }[] = [];
  for (const node of tree.nodes ?? []) {
    const role = node.role?.value;
    if (!role || !NAMED_ROLES.has(role)) continue;
    if (node.ignored) continue;
    if ((node.name?.value ?? "").trim()) continue;

    let html = `<${role}>`;
    if (node.backendDOMNodeId) {
      try {
        await session.send("DOM.enable");
        const described = await session.send("DOM.describeNode", {
          backendNodeId: node.backendDOMNodeId,
        });
        const attrs = described.node?.attributes ?? [];
        const map: Record<string, string> = {};
        for (let i = 0; i < attrs.length; i += 2) map[attrs[i]] = attrs[i + 1];
        html = `<${described.node?.localName ?? role}${
          map["id"] ? ` id="${map["id"]}"` : ""
        }${map["aria-label"] ? ` aria-label="${map["aria-label"]}"` : ""}>`;
      } catch {
        /* keep the role-only label */
      }
    }
    unnamed.push({ role, html });
  }
  return unnamed;
}

/** Horizontal overflow in pixels; 0 means the page fits the viewport. */
export async function horizontalOverflow(page: import("@playwright/test").Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** The widest element extending past the viewport, for a useful failure message. */
export async function worstOverflowElement(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    let worst = 0;
    let detail: string | null = null;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) continue;
      const over = rect.right - limit;
      if (over > worst) {
        worst = over;
        const cls = typeof el.className === "string" ? el.className.slice(0, 60) : "";
        detail = `${el.tagName}${cls ? "." + cls : ""} w=${Math.round(rect.width)}`;
      }
    }
    return { worst: Math.round(worst), detail };
  });
}
