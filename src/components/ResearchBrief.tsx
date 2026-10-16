import { CheckCircle2, ExternalLink, Circle, AlertTriangle } from "lucide-react";
import { buildBrief, type BriefProperty } from "@/lib/brief";
import type { CostRules } from "@/lib/deal";

/** Step-by-step buyer verification plan. `compact` shows only the headline and open steps. */
export function ResearchBrief({ property, rules, compact = false }: { property: BriefProperty; rules: CostRules; compact?: boolean }) {
  const b = buildBrief(property, rules);
  const open = b.steps.filter((s) => s.status === "needed");
  const list = compact ? open.slice(0, 3) : b.steps;
  return (
    <div className="space-y-4 text-sm">
      <p><b>{b.readiness.seen} of {b.readiness.total}</b> checks have a document on file. The rest are for you to verify before paying anything.</p>
      {b.redFlags.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
          {b.redFlags.map((f) => <li key={f} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />{f}</li>)}
        </ul>
      )}
      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.id} className="flex gap-2">
            {s.status === "seen" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            <div>
              <p className="font-medium">{s.title}{s.status === "seen" && <span className="ml-2 text-xs font-normal text-muted-foreground">document on file</span>}</p>
              {!compact && <p className="text-muted-foreground">{s.why}</p>}
              <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href={s.link.url} target="_blank" rel="noopener noreferrer">{s.link.label} <ExternalLink className="size-3" /></a>
            </div>
          </li>
        ))}
      </ul>
      {!compact && (
        <>
          <div>
            <p className="font-medium">Ask the seller</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">{b.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </div>
          <p className="text-muted-foreground"><b className="text-foreground">On site:</b> {b.sitePrompt}</p>
        </>
      )}
      <p className="text-xs text-muted-foreground">A checklist from the listing data and official sources, not legal advice. PropWise does not certify title or approvals. Have a lawyer review the documents before you pay.</p>
    </div>
  );
}
