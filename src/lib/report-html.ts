/**
 * Turns a saved buyer report into a clean, printable HTML document: nested
 * report data becomes labelled tables instead of raw JSON. Pure functions only.
 */

import { renderReportEvidenceHtml, type ReportEvidence } from "./decision-report";

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Short forms that must stay upper-case in labels, and units spelled out. */
const LABEL_WORDS: Record<string, string> = {
  emi: "EMI", ec: "EC", id: "ID", bhk: "BHK", dtcp: "DTCP", cmda: "CMDA", rera: "RERA", tnrera: "TNRERA",
  gst: "GST", inr: "INR", ai: "AI", url: "URL", pct: "%", sqft: "sq ft", ppsf: "per sq ft",
};

/** "preferred_locations" → "Preferred locations"; "emi_pct" → "EMI %". */
export function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const out = words.map((w) => LABEL_WORDS[w] ?? w);
  const first = out[0] ?? "";
  if (first && first === words[0]) out[0] = first.charAt(0).toUpperCase() + first.slice(1);
  return out.join(" ");
}

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** One value as table-cell HTML. Missing values read "Unknown", never blank or zero. */
export function cellHtml(v: unknown): string {
  if (v == null || v === "") return "<i>Unknown</i>";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? esc(v.toLocaleString("en-IN", { maximumFractionDigits: 2 })) : "<i>Unknown</i>";
  if (Array.isArray(v)) {
    if (v.length === 0) return "<i>None</i>";
    if (v.every((x) => !isPlain(x) && !Array.isArray(x))) return esc(v.map((x) => (x == null ? "Unknown" : String(x))).join(", "));
    return tableHtml(v);
  }
  if (isPlain(v)) return tableHtml(v);
  return esc(v);
}

/**
 * Data as an HTML table: a list of records becomes rows with one column per
 * field; a record becomes a two-column field/value table.
 */
export function tableHtml(v: unknown): string {
  if (Array.isArray(v) && v.length > 0 && v.every(isPlain)) {
    const cols: string[] = [];
    for (const row of v) for (const k of Object.keys(row)) if (!cols.includes(k)) cols.push(k);
    const head = cols.map((c) => `<th>${esc(humanize(c))}</th>`).join("");
    const body = v.map((row) => `<tr>${cols.map((c) => `<td>${cellHtml(row[c])}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  }
  if (isPlain(v)) {
    const rows = Object.entries(v).map(([k, x]) => `<tr><th scope="row">${esc(humanize(k))}</th><td>${cellHtml(x)}</td></tr>`).join("");
    return rows ? `<table><tbody>${rows}</tbody></table>` : "<p><i>None</i></p>";
  }
  return `<p>${cellHtml(v)}</p>`;
}

const section = (title: string, v: unknown) => (v === undefined ? "" : `<section><h2>${esc(title)}</h2>${tableHtml(v)}</section>`);

const STYLE = `body{font-family:Georgia,serif;color:#1a1a1a;max-width:860px;margin:2rem auto;padding:0 1rem;line-height:1.45}
h1{font-size:1.7rem;margin-bottom:.25rem}h2{font-size:1.2rem;border-bottom:2px solid #1f4d3a;padding-bottom:.2rem;margin-top:2rem}h3{font-size:1.05rem;margin-top:1.4rem}
table{border-collapse:collapse;width:100%;margin:.5rem 0;font-size:.9rem}th,td{border:1px solid #ccc;padding:.35rem .5rem;text-align:left;vertical-align:top}
thead th{background:#eef3f0}th[scope=row]{background:#f7f7f7;width:35%;font-weight:600}td table{margin:0;font-size:.85rem}
.note{background:#fff8e6;border-left:4px solid #c98a00;padding:.5rem .75rem}
@media print{body{margin:0;max-width:none}h2{break-after:avoid}table,tr,section{break-inside:avoid}a{color:inherit}}`;

type SavedReport = {
  generated_at?: string;
  requirements?: unknown;
  observed_facts?: unknown;
  calculations?: unknown;
  evidence?: ReportEvidence;
  assumptions?: unknown;
  interpretation?: unknown;
  inventory_note?: string;
  due_diligence_questions?: string[];
};

/** The full downloadable report. Older saved reports without some sections still render. */
export function buildReportHtml(title: string, result: unknown): string {
  const r = (isPlain(result) ? result : {}) as SavedReport;
  const generated = r.generated_at ? `<p>Generated ${esc(new Date(r.generated_at).toLocaleString("en-IN"))}</p>` : "";
  const questions = Array.isArray(r.due_diligence_questions) ? r.due_diligence_questions : [];
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE}</style><body>
<h1>${esc(title)}</h1>${generated}
<p class="note"><b>PropWise AI buyer decision report.</b> Estimates only — not legal verification, a title certificate or an approval certification.</p>
${section("Your requirements", r.requirements)}${section("Observed facts (from listings)", r.observed_facts)}${section("Calculations", r.calculations)}
${r.evidence ? `<section>${renderReportEvidenceHtml(r.evidence)}</section>` : ""}
${section("Assumptions", r.assumptions)}${section("AI interpretation", r.interpretation)}${r.inventory_note ? `<p><i>${esc(r.inventory_note)}</i></p>` : ""}
<section><h2>Questions to ask before paying any advance</h2><ol>${questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ol></section>
</body></html>`;
}
