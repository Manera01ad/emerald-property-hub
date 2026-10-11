import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { VERIFICATION } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function VerificationBadge({ status, className }: { status: string; className?: string }) {
  const Icon = status === "verified" ? ShieldCheck : status === "partially_verified" ? ShieldQuestion : ShieldAlert;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        status === "verified" && "bg-secondary text-success",
        status === "partially_verified" && "bg-gold-soft text-accent-foreground",
        status === "unverified" && "bg-warning-soft text-warning",
        className,
      )}
    >
      <Icon className="size-3.5" /> {VERIFICATION[status] ?? status}
    </span>
  );
}

export function EstimateNote({ children }: { children: React.ReactNode }) {
  return <p className="rounded-md border border-dashed bg-warning-soft px-3 py-2 text-xs text-warning">{children}</p>;
}
