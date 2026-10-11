export function formatINR(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(2).replace(/\.00$/, "")} L`;
  return `₹${Math.round(v).toLocaleString("en-IN")}`;
}

export function formatINRFull(n: number | null | undefined): string {
  if (n == null || isNaN(Number(n))) return "—";
  return `₹${Math.round(Number(n)).toLocaleString("en-IN")}`;
}
