import { EvidenceBadge } from "@/components/EvidenceBadge";
import type { Evidence } from "@/lib/evidence";
import { formatINR, formatINRFull } from "@/lib/format";
import { compareLease, permittedUseLabel, renewalLabel } from "@/lib/lease";
import { compareRental, furnishingLabel } from "@/lib/rental";
import { termsOf, type TransactionType } from "@/lib/transaction";

function Row({
  label,
  value,
  evidence,
  note,
}: {
  label: string;
  value: string;
  evidence: Evidence;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b py-2 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm">{value}</span>
        <EvidenceBadge evidence={evidence} />
      </div>
    </div>
  );
}

function money(value: number | null): string {
  return value == null ? "Unknown" : formatINRFull(value);
}

/**
 * Rental and lease terms for one listing. Every figure carries a badge, and anything the
 * owner has not stated reads as Unknown rather than being left blank or assumed to be zero.
 */
export function TransactionTerms({ listing, type }: { listing: unknown; type: TransactionType }) {
  if (type === "buy") return null;
  const terms = termsOf(listing, type);

  if (type === "rent") {
    const c = compareRental(terms);
    return (
      <section className="rounded-xl border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Rental terms</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {c.known} of {c.total} terms stated <EvidenceBadge evidence={c.evidence} />
          </div>
        </div>
        <div className="mt-2">
          <Row
            label="Monthly rent"
            value={money(terms.monthly_rent)}
            evidence={terms.monthly_rent == null ? "UNKNOWN" : "CLAIM"}
          />
          <Row
            label="Monthly maintenance"
            value={money(terms.maintenance_monthly)}
            evidence={terms.maintenance_monthly == null ? "UNKNOWN" : "CLAIM"}
            note="Usually excluded from the headline rent."
          />
          <Row
            label="Monthly total"
            value={money(c.monthly.total)}
            evidence={c.monthly.evidence}
            note={c.monthly.note}
          />
          <Row
            label="Deposit (refundable)"
            value={money(terms.deposit)}
            evidence={terms.deposit == null ? "UNKNOWN" : "CLAIM"}
          />
          <Row
            label="Cash needed to move in"
            value={money(c.moveIn.total)}
            evidence={c.moveIn.evidence}
            note={c.moveIn.note}
          />
          <Row
            label="Furnishing"
            value={furnishingLabel(terms.furnishing)}
            evidence={c.furnishing.evidence}
          />
          <Row
            label="Available from"
            value={terms.available_from ?? "Unknown"}
            evidence={c.availableFrom.evidence}
          />
        </div>
        {c.gaps.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Not stated by the owner: {c.gaps.join(", ")}. Ask for these before comparing.
          </p>
        )}
      </section>
    );
  }

  const c = compareLease(terms);
  return (
    <section className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Lease terms</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {c.known} of {c.totalFields} terms stated <EvidenceBadge evidence={c.evidence} />
        </div>
      </div>
      <div className="mt-2">
        <Row
          label="Monthly rent"
          value={money(terms.monthly_rent)}
          evidence={terms.monthly_rent == null ? "UNKNOWN" : "CLAIM"}
        />
        <Row
          label="Lease duration"
          value={c.duration.months == null ? "Unknown" : `${c.duration.months} months`}
          evidence={c.duration.evidence}
        />
        <Row label="Deposit" value={money(terms.deposit)} evidence={c.deposit.evidence} />
        <Row
          label="Annual escalation"
          value={c.escalation.pct == null ? "Unknown" : `${c.escalation.pct}%`}
          evidence={c.escalation.evidence}
        />
        <Row
          label="Permitted use"
          value={permittedUseLabel(terms.permitted_use)}
          evidence={c.permittedUse.evidence}
        />
        <Row
          label="Renewal"
          value={renewalLabel(terms.renewal_terms)}
          evidence={c.renewal.evidence}
        />
        <Row
          label="Total rent over the term"
          value={money(c.total.total)}
          evidence={c.total.evidence}
          note={c.total.note}
        />
      </div>
      {c.cautions.length > 0 && (
        <div className="mt-3 rounded-md bg-warning-soft p-3 text-xs">
          <p className="font-medium">Ask before signing</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
            {c.cautions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
