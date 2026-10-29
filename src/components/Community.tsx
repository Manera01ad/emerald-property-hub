import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { useLocalities } from "@/lib/data";
import {
  CATEGORY_LABELS, COMMUNITY_CATEGORIES, STATUS_LABELS, validatePost, type CommunityCategory,
} from "@/lib/community";
import { createThread, listThreads } from "@/lib/community-data";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

/** Thread starter. Signed-in users only; new accounts wait for review before anything is public. */
export function NewThreadForm() {
  const { session } = useSession();
  const { data: localities = [] } = useLocalities();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("localities");
  const [locality, setLocality] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Link to="/auth" className="underline">Sign in</Link> to start a thread or reply. Reading is open to everyone.
      </p>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validatePost({ title, body, category });
    if (!check.ok) { toast.error(check.error); return; }
    setBusy(true);
    try {
      await createThread({
        author_id: session!.user.id,
        category,
        locality_slug: locality || null,
        title: title.trim(),
        body: body.trim(),
      });
      toast.success("Posted. New accounts are reviewed before a post appears publicly.");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["community", "threads"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4 shadow-card">
      <h2 className="text-lg font-semibold">Start a thread</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="th-cat">Category</Label>
          <select id="th-cat" className={sel} value={category} onChange={(e) => setCategory(e.target.value as CommunityCategory)}>
            {COMMUNITY_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="th-loc">Locality (optional)</Label>
          <select id="th-loc" className={sel} value={locality} onChange={(e) => setLocality(e.target.value)}>
            <option value="">Not about one locality</option>
            {localities.map((l) => <option key={l.id} value={l.slug}>{l.name}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="th-title">Title</Label>
        <Input id="th-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="th-body">Your post</Label>
        <Textarea id="th-body" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Do not post phone numbers, email addresses or messaging links. They are refused, so nobody assumes a hidden number reached anyone.
      </p>
      <Button type="submit" variant="gold" disabled={busy}>{busy ? "Posting…" : "Post thread"}</Button>
    </form>
  );
}

/** The public feed. Only published threads are readable, which row-level security enforces too. */
export function ThreadList() {
  const { data = [], isLoading, isError, error } = useQuery({ queryKey: ["community", "threads"], queryFn: () => listThreads() });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (isError) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (data.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Nothing has been posted yet. Threads from new accounts are reviewed before they appear here.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {data.map((t) => (
        <li key={t.id} className="rounded-xl border bg-card p-4 shadow-card">
          <Link to="/community/$threadId" params={{ threadId: t.id }} className="text-lg font-medium hover:underline">{t.title}</Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {CATEGORY_LABELS[t.category]}
            {t.locality_slug && ` · ${t.locality_slug.replace(/-/g, " ")}`}
            {` · ${new Date(t.created_at).toLocaleDateString("en-IN")}`}
            {t.status !== "published" && ` · ${STATUS_LABELS[t.status]}`}
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.body}</p>
        </li>
      ))}
    </ul>
  );
}
