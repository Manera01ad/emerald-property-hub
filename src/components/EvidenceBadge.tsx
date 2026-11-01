import { CircleHelp, ClipboardList, Landmark, Sigma, ShieldCheck, Users } from "lucide-react";
import { EVIDENCE_HELP, EVIDENCE_LABELS, type Evidence } from "@/lib/evidence";
import { cn } from "@/lib/utils";

/**
 * One icon and one colour per label. Both are `Record<Evidence, ...>`, so adding a
 * label to evidence.ts without giving it a badge is a type error rather than a
 * badge that silently renders nothing.
 *
 * The colours are deliberate: only VERIFIED and OFFICIAL_SOURCE use the success
 * green, and COMMUNITY_REPORTED uses the same muted treatment as CLAIM, so a
 * community report does not read as an official one at a glance.
 */
const ICONS: Record<Evidence, typeof ShieldCheck> = {
  VERIFIED: ShieldCheck,
  OFFICIAL_SOURCE: Landmark,
  COMMUNITY_REPORTED: Users,
  ESTIMATE: Sigma,
  CLAIM: ClipboardList,
  UNKNOWN: CircleHelp,
};

const STYLES: Record<Evidence, string> = {
  VERIFIED: "bg-secondary text-success",
  OFFICIAL_SOURCE: "bg-secondary text-success",
  COMMUNITY_REPORTED: "bg-secondary text-muted-foreground",
  ESTIMATE: "bg-gold-soft text-accent-foreground",
  CLAIM: "bg-secondary text-muted-foreground",
  UNKNOWN: "bg-warning-soft text-warning",
};

/** Shows how much weight a figure carries. UNKNOWN is a result, not a blank. */
export function EvidenceBadge({ evidence, className }: { evidence: Evidence; className?: string }) {
  const Icon = ICONS[evidence];
  return (
    <span
      title={EVIDENCE_HELP[evidence]}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        STYLES[evidence],
        className,
      )}
    >
      <Icon className="size-3.5" /> {EVIDENCE_LABELS[evidence]}
    </span>
  );
}
