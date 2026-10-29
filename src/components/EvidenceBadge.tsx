import { CircleHelp, ClipboardList, Sigma, ShieldCheck } from "lucide-react";
import { EVIDENCE_HELP, EVIDENCE_LABELS, type Evidence } from "@/lib/evidence";
import { cn } from "@/lib/utils";

const ICONS: Record<Evidence, typeof ShieldCheck> = {
  VERIFIED: ShieldCheck,
  ESTIMATE: Sigma,
  CLAIM: ClipboardList,
  UNKNOWN: CircleHelp,
};

/** Shows how much weight a figure carries. UNKNOWN is a result, not a blank. */
export function EvidenceBadge({ evidence, className }: { evidence: Evidence; className?: string }) {
  const Icon = ICONS[evidence];
  return (
    <span
      title={EVIDENCE_HELP[evidence]}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        evidence === "VERIFIED" && "bg-secondary text-success",
        evidence === "ESTIMATE" && "bg-gold-soft text-accent-foreground",
        evidence === "CLAIM" && "bg-secondary text-muted-foreground",
        evidence === "UNKNOWN" && "bg-warning-soft text-warning",
        className,
      )}
    >
      <Icon className="size-3.5" /> {EVIDENCE_LABELS[evidence]}
    </span>
  );
}
