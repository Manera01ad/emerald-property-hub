import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { STATUS_LABELS, nextStatuses, statusTone, type SubmissionStatus } from "@/lib/submissions";
import { approveSubmission, listSubmissions, setSubmissionStatus, type Submission } from "@/lib/submissions-data";
import { Panel } from "./shared";

/** Review queue for owner and developer submissions. Nothing here is public until it is approved and then published. */
export function Submissions() {
  const qc = useQueryClient();
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ["admin", "listing_submissions"], queryFn: listSubmissions });
  const [openId, setOpenId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "listing_submissions"] });

  async function move(s: Submission, status: SubmissionStatus) {
    if (status !== "approved" && !reason.trim()) { toast.error("A reason is required when a submission is not approved."); return; }
    setBusy(true);
    try {
      if (status === "approved") await approveSubmission(s.id, title, reason.trim() || null);
      else await setSubmissionStatus(s.id, status, reason.trim());
      toast.success(status === "approved" ? "Approved. The listing is a draft until you publish it." : `Marked ${STATUS_LABELS[status].toLowerCase()}.`);
      setOpenId(null); setReason(""); setTitle("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h2 className="text-xl">Listing submissions</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Owner and developer submissions waiting for review. Approval creates a draft listing with recorded permission; publishing it is still a separate decision.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No submissions yet.</p>
      ) : (
        <div className="mt-4 divide-y">
          {data.map((s) => (
            <div key={s.id} className="py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-56">
                  <p className="font-medium">{s.property_type.replace(/_/g, " ")} · {s.locality_slug.replace(/-/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">{s.submitter_kind} · sent {new Date(s.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${statusTone(s.status)}`}>{STATUS_LABELS[s.status]}</span>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setOpenId(openId === s.id ? null : s.id); setReason(""); setTitle(""); }}>
                    {openId === s.id ? "Close" : "Review"}
                  </Button>
                </div>
              </div>

              {openId === s.id && (
                <div className="mt-4 space-y-4 rounded-lg border bg-muted/30 p-4">
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <p><span className="text-muted-foreground">Name:</span> {s.submitter_name}</p>
                    <p><span className="text-muted-foreground">Kind:</span> {s.submitter_kind}</p>
                    <p><span className="text-muted-foreground">Phone:</span> {s.contact_phone}</p>
                    <p><span className="text-muted-foreground">Email:</span> {s.contact_email}</p>
                    {s.rera_number && <p><span className="text-muted-foreground">TNRERA:</span> {s.rera_number}</p>}
                    <p><span className="text-muted-foreground">Bedrooms:</span> {s.bedrooms ?? "not stated"}</p>
                    <p><span className="text-muted-foreground">Built area:</span> {s.built_area_sqft ?? "not stated"}</p>
                    <p><span className="text-muted-foreground">Land area:</span> {s.land_area_sqft ?? "not stated"}</p>
                    <p><span className="text-muted-foreground">Asking price:</span> {s.asking_price ?? "not stated"}</p>
                  </div>
                  {s.description && <p className="text-sm">{s.description}</p>}
                  <div className="rounded-md border bg-background p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Declaration accepted {new Date(s.declared_at).toLocaleString("en-IN")} · version {s.declaration_version}</p>
                    <p className="mt-1">{s.declaration_text}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Contact details stay here. They are never copied to the public listing.</p>

                  {s.status === "approved" ? (
                    <p className="text-sm text-muted-foreground">Already approved. Publish the draft listing from the Properties tab when you are ready.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`reason-${s.id}`}>Reason (required unless approving)</Label>
                        <Input id={`reason-${s.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. asking price looks wrong" />
                      </div>
                      {nextStatuses(s.status).includes("approved") && (
                        <div className="space-y-1.5">
                          <Label htmlFor={`title-${s.id}`}>Public title (used only if you approve)</Label>
                          <Input id={`title-${s.id}`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 3-bedroom villa in Tambaram" />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {nextStatuses(s.status).map((next) => (
                          <Button key={next} size="sm" variant={next === "approved" ? "gold" : "outline"} disabled={busy} onClick={() => move(s, next)}>
                            {next === "approved" ? "Approve and create draft" : `Mark ${STATUS_LABELS[next].toLowerCase()}`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
