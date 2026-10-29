import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABELS, STATUS_LABELS, statusTone, type PostStatus } from "@/lib/community";
import { listQueue, setPostStatus, setThreadStatus, type Post, type Thread } from "@/lib/community-data";
import { Panel } from "./shared";

const DECISIONS: { status: PostStatus; label: string }[] = [
  { status: "published", label: "Publish" },
  { status: "hidden", label: "Hide" },
  { status: "removed", label: "Remove" },
];

/**
 * Community moderation queue. Nothing here publishes automatically: items arrive because an
 * account is new or because three reports hid them. Every decision is stored with a reason.
 */
export function CommunityQueue() {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["admin", "community-queue"], queryFn: listQueue });
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "community-queue"] });

  async function decide(kind: "thread" | "post", id: string, status: PostStatus) {
    const reason = (reasons[id] ?? "").trim();
    if (status !== "published" && !reason) { toast.error("A reason is required to hide or remove a post."); return; }
    setBusy(true);
    try {
      if (kind === "thread") await setThreadStatus(id, status, reason || null);
      else await setPostStatus(id, status, reason || null);
      toast.success(`Marked ${STATUS_LABELS[status].toLowerCase()}.`);
      setReasons((r) => ({ ...r, [id]: "" }));
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function row(kind: "thread" | "post", item: Thread | Post) {
    const isThread = kind === "thread";
    const label = isThread ? (item as Thread).title : (item as Post).body.slice(0, 80);
    const sub = isThread ? CATEGORY_LABELS[(item as Thread).category] : `Reply in thread ${(item as Post).thread_id.slice(0, 8)}`;
    return (
      <div key={item.id} className="rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{sub} · {new Date(item.created_at).toLocaleString("en-IN")}</p>
          </div>
          <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${statusTone(item.status)}`}>{STATUS_LABELS[item.status]}</span>
        </div>
        {isThread && <p className="mt-2 whitespace-pre-wrap text-sm">{item.body}</p>}
        {item.moderation_reason && <p className="mt-2 text-xs text-muted-foreground">Reason so far: {item.moderation_reason}</p>}
        <div className="mt-3 space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor={`reason-${item.id}`}>Reason (required to hide or remove)</Label>
            <Input id={`reason-${item.id}`} value={reasons[item.id] ?? ""} onChange={(e) => setReasons((r) => ({ ...r, [item.id]: e.target.value }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            {DECISIONS.map((d) => (
              <Button key={d.status} size="sm" variant={d.status === "published" ? "gold" : "outline"} disabled={busy} onClick={() => decide(kind, item.id, d.status)}>
                {d.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Panel>
      <h2 className="text-xl">Community moderation</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Threads and replies waiting for a person. Hiding or removing needs a reason, and every decision is written to the moderation log.
      </p>
      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
      ) : isError ? (
        <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>
      ) : !data || (data.threads.length === 0 && data.posts.length === 0) ? (
        <p className="mt-4 text-sm text-muted-foreground">Nothing is waiting for review.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {data.threads.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Threads ({data.threads.length})</h3>
              <div className="space-y-3">{data.threads.map((t) => row("thread", t))}</div>
            </div>
          )}
          {data.posts.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-medium">Replies ({data.posts.length})</h3>
              <div className="space-y-3">{data.posts.map((p) => row("post", p))}</div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
