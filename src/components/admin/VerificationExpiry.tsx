import { verificationExpiry, EXPIRY_WINDOW_DAYS, type ExpiryItem, type ExpiryReport } from "@/lib/verification-expiry";
import { Panel, useAdminTable } from "./shared";

function when(d: number | null): string {
  if (d == null) return "no expiry date set";
  if (d < 0) return `expired ${-d} day${d === -1 ? "" : "s"} ago`;
  if (d === 0) return "expires today";
  return `expires in ${d} day${d === 1 ? "" : "s"}`;
}

function Group({ id, title, tone, items }: { id: string; title: string; tone: string; items: ExpiryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div data-testid={`expiry-group-${id}`}>
      <p className={`text-sm font-semibold ${tone}`}>{title} ({items.length})</p>
      <ul className="mt-1 space-y-1 text-sm">
        {items.map((x) => (
          <li key={x.id} className="flex flex-wrap justify-between gap-2">
            <a href={`/properties/${encodeURIComponent(x.id)}`} className="text-primary hover:underline" data-testid={`expiry-listing-link-${x.id}`}>{x.title}</a>
            <span className="text-muted-foreground">{x.location} · {when(x.daysLeft)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Presentational list, kept separate from the data hook so it is testable. */
export function ExpiryList({ report }: { report: ExpiryReport }) {
  const none = report.expired.length + report.dueSoon.length + report.noExpiry.length === 0;
  return (
    <div className="mt-3 space-y-4">
      {none && <p className="text-sm text-muted-foreground" data-testid="expiry-all-clear">No verified listing expires in the next {EXPIRY_WINDOW_DAYS} days.</p>}
      <Group id="expired" title="Expired — buyers now see these as expired" tone="text-destructive" items={report.expired} />
      <Group id="due-soon" title={`Expires within ${EXPIRY_WINDOW_DAYS} days`} tone="text-warning" items={report.dueSoon} />
      <Group id="no-expiry" title="Verified with no expiry date — set one" tone="text-muted-foreground" items={report.noExpiry} />
    </div>
  );
}

export function VerificationExpiry() {
  const { data: props = [] } = useAdminTable("properties");
  return (
    <Panel>
      <p className="font-medium">Verification re-checks</p>
      <p className="text-sm text-muted-foreground">Listings whose verification has expired or expires soon. Re-check the documents, then update the verification date and expiry on the listing.</p>
      <ExpiryList report={verificationExpiry(props)} />
    </Panel>
  );
}
