import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { useFlag } from "@/lib/use-flag";
import { CATEGORY_LABELS, STATUS_LABELS, validatePost } from "@/lib/community";
import { createPost, deletePost, getThread, listPosts, reportPost, type Post } from "@/lib/community-data";

export const Route = createFileRoute("/community_/$threadId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Thread — PropWise AI community" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const open = useFlag("feature_community");
  const { session } = useSession();
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const thread = useQuery({ queryKey: ["community", "thread", threadId], queryFn: () => getThread(threadId) });
  const posts = useQuery({ queryKey: ["community", "posts", threadId], queryFn: () => listPosts(threadId) });

  if (!open) {
    return <div className="mx-auto max-w-3xl px-4 py-14"><p className="text-muted-foreground">The community is not open yet.</p></div>;
  }
  if (thread.isLoading) {
    return <div className="mx-auto max-w-3xl px-4 py-14"><p className="text-muted-foreground">Loading…</p></div>;
  }
  if (!thread.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl">Thread not found</h1>
        <p className="mt-2 text-muted-foreground">It may have been removed, or it is still waiting for review.</p>
        <Button asChild variant="gold" className="mt-6"><Link to="/community">Back to the community</Link></Button>
      </div>
    );
  }

  const t = thread.data;

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validatePost({ body: reply });
    if (!check.ok) { toast.error(check.error); return; }
    setBusy(true);
    try {
      await createPost({ thread_id: t.id, author_id: session!.user.id, body: reply.trim() });
      toast.success("Reply sent. New accounts are reviewed first.");
      setReply("");
      qc.invalidateQueries({ queryKey: ["community", "posts", threadId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p: Post) {
    if (!confirm("Delete your reply?")) return;
    try {
      await deletePost(p.id);
      toast.success("Deleted.");
      qc.invalidateQueries({ queryKey: ["community", "posts", threadId] });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function report(p: Post) {
    const reason = prompt("Why are you reporting this reply?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await reportPost(p.id, reason.trim());
      toast.success("Reported. Three reports hide a post until it is reviewed.");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm text-muted-foreground">
        <Link to="/community" className="underline">Community</Link> · {CATEGORY_LABELS[t.category]}
        {t.locality_slug && ` · ${t.locality_slug.replace(/-/g, " ")}`}
      </p>
      <h1 className="mt-1 text-3xl">{t.title}</h1>
      <p className="mt-1 text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-IN")}</p>
      <p className="mt-3 whitespace-pre-wrap">{t.body}</p>

      <section className="mt-8">
        <h2 className="text-2xl">Replies</h2>
        {posts.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : (posts.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No published replies yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {(posts.data ?? []).map((p) => (
              <li key={p.id} className="rounded-xl border bg-card p-4 shadow-card">
                <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("en-IN")} · {STATUS_LABELS[p.status]}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{p.body}</p>
                {session && (
                  <div className="mt-2 flex gap-3 text-xs">
                    {p.author_id === session.user.id && <button className="underline" onClick={() => remove(p)}>Delete</button>}
                    <button className="underline" onClick={() => report(p)}>Report</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {session ? (
          <form onSubmit={send} className="mt-5 space-y-3">
            <Textarea rows={4} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add a reply" />
            <Button type="submit" variant="gold" disabled={busy}>{busy ? "Sending…" : "Reply"}</Button>
          </form>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground"><Link to="/auth" className="underline">Sign in</Link> to reply.</p>
        )}
      </section>
    </div>
  );
}
