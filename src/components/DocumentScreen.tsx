import { AlertTriangle, CheckCircle2, CircleDashed, Clock, MinusCircle, XCircle } from "lucide-react";
import { EvidenceBadge } from "@/components/EvidenceBadge";
import { DOC_STATUS_LABELS, screenDocuments, type DocStatus } from "@/lib/document-screen";
import type { ListingFacts } from "@/lib/verification";
import { cn } from "@/lib/utils";

const ICONS: Record<DocStatus, typeof CheckCircle2> = {
  verified: CheckCircle2,
  recorded: CircleDashed,
  expired: Clock,
  missing: XCircle,
  not_applicable: MinusCircle,
};

const TONES: Record<DocStatus, string> = {
  verified: "text-success",
  recorded: "text-muted-foreground",
  expired: "text-warning",
  missing: "text-destructive",
  not_applicable: "text-muted-foreground",
};

/** Per-document screen: what is verified, only recorded, expired or missing on this listing. */
export function DocumentScreen({ listing }: { listing: ListingFacts }) {
  const s = screenDocuments(listing);
  return (
    <div className="space-y-4" data-testid="document-screen">
      <p
        data-testid="document-screen-headline"
        className={cn("flex items-start gap-2 rounded-lg p-3 text-sm", s.needsAttention ? "bg-warning-soft text-warning" : "bg-secondary")}
      >
        {s.needsAttention ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />}
        <span>{s.headline}</span>
      </p>
      <p className="text-xs text-muted-foreground" data-testid="document-screen-counts">
        {s.counts.verified} verified · {s.counts.recorded} recorded, not verified · {s.counts.expired} expired · {s.counts.missing} missing
      </p>
      <ul className="space-y-2">
        {s.checks.map((c) => {
          const Icon = ICONS[c.status];
          return (
            <li key={c.key} className="rounded-lg border p-3" data-testid={`document-check-${c.key}`}>
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                <Icon className={cn("size-4", TONES[c.status])} />
                {c.label}
                <span className={cn("text-xs font-medium", TONES[c.status])}>{DOC_STATUS_LABELS[c.status]}</span>
                {c.evidence && <EvidenceBadge evidence={c.evidence} />}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
