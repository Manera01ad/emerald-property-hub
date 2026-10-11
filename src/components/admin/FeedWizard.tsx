import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { humanize } from "@/lib/constants";
import { MAPPABLE_FIELDS, parseCsv } from "@/lib/research/core";
import { importCsvRows } from "@/lib/research.functions";
import { Panel, selectCls } from "./shared";

const KINDS = ["licensed_feed", "partner_api", "developer_site", "owner_submitted"];
const STEPS = ["Source identity", "Permission", "Access & field mapping", "Refresh & save"];

/** Step-by-step onboarding for an authorised property feed (CSV upload or documented JSON API). Imported records stay private. */
export function FeedWizard({ onChange }: { onChange: () => void }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: "", identity: "", kind: "developer_site", evidence: "", usage: "", method: "csv_upload" as "csv_upload" | "json_feed", url: "", docs: "", refresh: 24, limit: 50 });
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === "refresh" || k === "limit" ? Number(e.target.value) : e.target.value });

  async function readCsv(file: File) {
    const parsed = parseCsv(await file.text());
    if (!parsed.length) return void toast.error("No rows found in that file.");
    setRows(parsed);
    const cols = Object.keys(parsed[0]);
    setColumns(cols);
    // Pre-fill obvious matches
    setMap(Object.fromEntries(MAPPABLE_FIELDS.map((m) => [m, cols.find((c) => c.toLowerCase().replace(/\W/g, "") === m.replace(/_/g, "")) ?? ""])));
  }

  const valid = [
    f.name.trim().length > 1 && f.identity.trim().length > 1,
    f.evidence.trim().length > 10,
    !!map["id"] && (f.method === "csv_upload" ? rows.length > 0 : /^https:\/\//.test(f.url) && /^https:\/\//.test(f.docs)),
    f.refresh >= 1 && f.refresh <= 720 && f.limit >= 1 && f.limit <= 500,
  ];
  const mappingFields = f.method === "json_feed" ? MAPPABLE_FIELDS : MAPPABLE_FIELDS;

  const runImport = useServerFn(importCsvRows);
  async function save() {
    const mapping = Object.fromEntries(Object.entries(map).filter(([, v]) => v));
    const { data: src, error } = await supabase.from("research_sources").insert({
      name: f.name.trim().slice(0, 120), source_identity: f.identity.trim().slice(0, 200), kind: f.kind, access_method: f.method,
      url: f.method === "csv_upload" ? `csv://${f.name.trim().slice(0, 80)}` : f.url.trim(), api_docs_url: f.docs.trim() || null,
      permission_evidence: f.evidence.trim(), permitted_usage: f.usage.trim() || null, permission_status: "authorised", enabled: true,
      can_publish: false, field_mapping: mapping, refresh_hours: f.refresh, rate_limit_per_run: f.limit,
    }).select("id").single();
    if (error) return void toast.error(error.message);
    if (f.method === "csv_upload") {
      try {
        const r = await runImport({ data: { sourceId: src.id, rows: rows.slice(0, 500) } });
        toast.success(`Imported: ${r.added} new, ${r.changed} price changes, ${r.ignored} rows without an id ignored. All are private and awaiting review.`);
      } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); }
    } else toast.success("Feed saved. The discovery agent will read it on its next run (or press Run now on Discovery).");
    setStep(0); setRows([]); setColumns([]); setMap({});
    setF({ ...f, name: "", identity: "", evidence: "", usage: "", url: "", docs: "" });
    onChange();
  }

  return (
    <Panel>
      <p className="font-medium">Connect an authorised property feed</p>
      <p className="mb-3 text-xs text-muted-foreground">For developers, brokers, owners or licensed feeds who have given you permission. Everything imported stays private — draft and unverified — until you confirm publication rights listing by listing.</p>
      <ol className="mb-4 flex flex-wrap gap-2 text-xs">
        {STEPS.map((s, i) => <li key={s} className={`rounded-full border px-3 py-1 ${i === step ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{i + 1}. {s}</li>)}
      </ol>

      {step === 0 && (
        <div className="grid gap-2 md:grid-cols-3">
          <Input placeholder="Source name (e.g. ABC Builders inventory)" value={f.name} onChange={set("name")} />
          <Input placeholder="Legal identity (company name, RERA/GST no.)" value={f.identity} onChange={set("identity")} />
          <select className={selectCls} value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{humanize(k)}</option>)}</select>
        </div>
      )}
      {step === 1 && (
        <div className="grid gap-2">
          <Textarea placeholder="Permission evidence: who granted it, when, and where the signed agreement or email is kept" value={f.evidence} onChange={set("evidence")} />
          <Input placeholder="Permitted usage (e.g. may display price and photos after owner confirms each listing)" value={f.usage} onChange={set("usage")} />
        </div>
      )}
      {step === 2 && (
        <div className="space-y-3">
          <select className={selectCls + " w-56"} value={f.method} onChange={(e) => { setF({ ...f, method: e.target.value as never }); setMap({}); setColumns([]); setRows([]); }}>
            <option value="csv_upload">CSV file upload</option><option value="json_feed">Documented JSON API</option>
          </select>
          {f.method === "csv_upload" ? (
            <div><Input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && readCsv(e.target.files[0])} />
              {rows.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{rows.length} rows, {columns.length} columns read.</p>}</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              <Input placeholder="https://feed URL (returns a JSON list)" value={f.url} onChange={set("url")} />
              <Input placeholder="https://link to the API documentation" value={f.docs} onChange={set("docs")} />
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {mappingFields.map((m) => (
              <label key={m} className="flex items-center gap-2 text-xs">
                <span className="w-28 shrink-0">{humanize(m)}{m === "id" && " *"}</span>
                {f.method === "csv_upload"
                  ? <select className={selectCls + " h-8"} value={map[m] ?? ""} onChange={(e) => setMap({ ...map, [m]: e.target.value })}><option value="">— not mapped —</option>{columns.map((c) => <option key={c}>{c}</option>)}</select>
                  : <Input className="h-8" placeholder="feed field name" value={map[m] ?? ""} onChange={(e) => setMap({ ...map, [m]: e.target.value.trim() })} />}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">A unique listing ID is required so re-imports update records instead of duplicating them.</p>
        </div>
      )}
      {step === 3 && (
        <div className="grid gap-2 md:grid-cols-2">
          <label className="text-xs">Refresh every (hours, 1–720)<Input type="number" min={1} max={720} value={f.refresh} onChange={set("refresh")} /></label>
          <label className="text-xs">Max listings per run (1–500)<Input type="number" min={1} max={500} value={f.limit} onChange={set("limit")} /></label>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
        {step < 3 ? <Button disabled={!valid[step]} onClick={() => setStep(step + 1)}>Next</Button>
          : <Button disabled={!valid.every(Boolean)} onClick={save}>{f.method === "csv_upload" ? "Save & import privately" : "Save feed"}</Button>}
      </div>
    </Panel>
  );
}

/** Operational summary: genuine automatic runs vs manual, source checks, usage and backlog. */
export function OpsReport({ ticks, sources, agents, runs, obsPending, changes, infraUnverified }: {
  ticks: Tables<"research_ticks">[]; sources: Tables<"research_sources">[]; agents: Tables<"research_agents">[]; runs: Tables<"research_runs">[];
  obsPending: number; changes: number; infraUnverified: number;
}) {
  const auto = ticks.find((t) => t.origin === "pg_cron");
  const next = new Date(); next.setUTCMinutes(5, 0, 0); if (next <= new Date()) next.setUTCHours(next.getUTCHours() + 1);
  const ok = sources.filter((s) => s.last_status?.startsWith("ok")).length;
  const bad = sources.filter((s) => s.last_status?.startsWith("error")).length;
  const cost = agents.reduce((s, a) => s + Number(a.est_cost_month), 0);
  const calls = agents.reduce((s, a) => s + a.api_calls_month, 0);
  const t = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="flex justify-between gap-4 border-b py-1 last:border-0"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>;
  return (
    <Panel>
      <p className="mb-2 font-medium">Operations report</p>
      <div className="grid gap-x-8 text-sm md:grid-cols-2">
        <Row k="Last genuine automatic check" v={auto ? `${t(auto.started_at)} · ${(auto.agents as unknown[]).length} agents due` : "None yet"} />
        <Row k="Next scheduled check" v={t(next.toISOString())} />
        <Row k="Source checks OK / failed" v={`${ok} / ${bad}`} />
        <Row k="Agent runs in log (failed)" v={`${runs.length} (${runs.filter((r) => r.status === "failed").length})`} />
        <Row k="Observations awaiting review" v={obsPending} />
        <Row k="Price changes recorded" v={changes} />
        <Row k="Infrastructure records awaiting verification" v={infraUnverified} />
        <Row k="API use this month" v={`${calls} calls · $${cost.toFixed(2)} est.`} />
      </div>
      <p className="mt-3 mb-1 text-xs font-medium">Source permission status</p>
      <ul className="space-y-0.5 text-xs">
        {sources.map((s) => <li key={s.id}>{s.name}: <b>{humanize(s.permission_status)}</b> · {s.enabled ? "enabled" : "disabled"}</li>)}
      </ul>
      <p className="mt-3 mb-1 text-xs font-medium">Scheduler log (latest 10)</p>
      <ul className="space-y-0.5 text-xs">
        {ticks.slice(0, 10).map((k) => (
          <li key={k.id}>{t(k.started_at)} · <b>{k.origin === "pg_cron" ? "automatic" : "manual call"}</b> · {(k.agents as { key: string; status: string }[]).map((a) => `${a.key}: ${a.status}`).join(", ") || "no agents due"}{k.error && <span className="text-destructive"> · {k.error}</span>}</li>
        ))}
        {ticks.length === 0 && <li className="text-muted-foreground">No scheduler checks logged yet.</li>}
      </ul>
    </Panel>
  );
}
