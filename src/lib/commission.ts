/** Expected commission comes only from recorded agreement terms: fixed amount wins, else % of deal value, else null (unknown). */
export function expectedCommission(c: { fixed_amount?: number | null; commission_pct?: number | null; deal_value?: number | null }): number | null {
  if (c.fixed_amount != null && c.fixed_amount > 0) return Number(c.fixed_amount);
  if (c.commission_pct != null && c.deal_value != null) return Math.round((Number(c.deal_value) * Number(c.commission_pct)) / 100);
  return null;
}
