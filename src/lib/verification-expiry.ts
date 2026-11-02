/**
 * Which listing verifications have expired or expire soon, so an admin can
 * re-check them before buyers rely on them. Pure functions only.
 */

export type ExpiryRow = {
  id: string;
  title: string;
  location: string;
  verification_status: string;
  verification_expiry: string | null;
};

export type ExpiryItem = ExpiryRow & { daysLeft: number | null };

export type ExpiryReport = {
  /** Past the expiry date: shown to buyers as expired already. */
  expired: ExpiryItem[];
  /** Expires within the window. */
  dueSoon: ExpiryItem[];
  /** Verified but with no expiry date, so it never prompts a re-check. */
  noExpiry: ExpiryItem[];
};

export const EXPIRY_WINDOW_DAYS = 30;

const DAY = 86_400_000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

export function verificationExpiry(
  rows: ExpiryRow[],
  today: string = new Date().toISOString().slice(0, 10),
  windowDays: number = EXPIRY_WINDOW_DAYS,
): ExpiryReport {
  const report: ExpiryReport = { expired: [], dueSoon: [], noExpiry: [] };
  for (const r of rows) {
    if (r.verification_status !== "verified" && r.verification_status !== "partially_verified") continue;
    if (!r.verification_expiry || Number.isNaN(Date.parse(`${r.verification_expiry}T00:00:00Z`))) {
      report.noExpiry.push({ ...r, daysLeft: null });
      continue;
    }
    const daysLeft = daysBetween(today, r.verification_expiry);
    if (daysLeft < 0) report.expired.push({ ...r, daysLeft });
    else if (daysLeft <= windowDays) report.dueSoon.push({ ...r, daysLeft });
  }
  const byDate = (a: ExpiryItem, b: ExpiryItem) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
  report.expired.sort(byDate);
  report.dueSoon.sort(byDate);
  report.noExpiry.sort((a, b) => a.title.localeCompare(b.title));
  return report;
}
