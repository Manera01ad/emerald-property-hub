import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAdminTable, Panel, Stat } from "./shared";
import { formatINR } from "@/lib/format";

function monthKey(d: string) {
  return d.slice(0, 7);
}

export function Overview() {
  const { data: props = [] } = useAdminTable("properties");
  const { data: enq = [] } = useAdminTable("enquiries");
  const { data: com = [] } = useAdminTable("commissions");
  const { data: visits = [] } = useAdminTable("site_visits", "visit_at");

  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7));
  const chart = months.map((m) => ({
    month: m,
    enquiries: enq.filter((e) => monthKey(e.created_at) === m).length,
    won: enq.filter((e) => e.status === "won" && monthKey(e.updated_at) === m).length,
    received: com.filter((c) => c.paid_date && monthKey(c.paid_date) === m).reduce((s, c) => s + Number(c.paid_amount), 0) / 1e5,
  }));

  const live = props.filter((p) => p.status === "published" && !p.is_demo && p.listing_permission).length;
  const expected = com.filter((c) => c.status !== "cancelled").reduce((s, c) => s + Number(c.expected_amount), 0);
  const paid = com.reduce((s, c) => s + Number(c.paid_amount), 0);
  const open = enq.filter((e) => !["won", "lost"].includes(e.status)).length;
  const today = new Date().toISOString().slice(0, 10);
  const due = enq.filter((e) => e.next_follow_up && e.next_follow_up <= today && !["won", "lost"].includes(e.status));
  const qualified = enq.filter((e) => ["qualified", "site_visit", "negotiation", "won"].includes(e.status)).length;
  const scheduled = visits.filter((v) => v.status === "scheduled").length;
  const wonDeals = enq.filter((e) => e.status === "won").length;

  return (
    <div className="mt-4 space-y-6">
      <Panel>
        <p className="mb-2 font-medium">Getting started</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Settings: enter your WhatsApp number, contact details, TNRERA registration status and confirmed Tamil Nadu cost rates.</li>
          <li>Partners: add the developers and owners you work with.</li>
          <li>Listings: create a draft, record owner permission and evidence, documents, survey number and verification dates.</li>
          <li>Add nearby schools, hospitals and transport only with a source you checked, then publish.</li>
          <li>Enquiries: move each buyer through New → Contacted → Qualified → Site visit → Negotiation → Won / Lost.</li>
          <li>Commissions: record the agreement, deal value, invoice, payment and receipt.</li>
        </ol>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Live listings" value={live} sub={`${props.length} total incl. drafts/demo`} />
        <Stat label="Open enquiries" value={open} sub={`${enq.length} total`} />
        <Stat label="Commission expected" value={formatINR(expected)} />
        <Stat label="Commission received" value={formatINR(paid)} sub={`${formatINR(expected - paid)} outstanding`} />
        <Stat label="Total enquiries" value={enq.length} />
        <Stat label="Qualified buyers" value={qualified} />
        <Stat label="Scheduled site visits" value={scheduled} />
        <Stat label="Won deals" value={wonDeals} />
      </div>
      <Panel>
        <p className="mb-4 font-medium">Monthly performance (last 6 months)</p>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="enquiries" fill="var(--chart-1)" name="Enquiries" />
              <Bar dataKey="won" fill="var(--chart-2)" name="Deals won" />
              <Bar dataKey="received" fill="var(--chart-3)" name="Commission received (₹ L)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel>
        <p className="mb-2 font-medium">Follow-ups due</p>
        {due.length === 0 ? <p className="text-sm text-muted-foreground">Nothing due today.</p> : (
          <ul className="space-y-1 text-sm">{due.map((e) => <li key={e.id}>{e.next_follow_up} — {e.name} ({e.phone}) · {e.status}</li>)}</ul>
        )}
      </Panel>
    </div>
  );
}
