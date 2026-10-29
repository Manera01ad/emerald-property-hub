import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NotOpenYet } from "@/components/NotOpenYet";
import { OwnerSubmissionForm } from "@/components/OwnerSubmissionForm";
import { useSession } from "@/lib/auth";
import { useFlag } from "@/lib/use-flag";
import { mySubmissions } from "@/lib/submissions-data";
import { STATUS_LABELS, statusTone } from "@/lib/submissions";

const URL = "https://emerald-property-hub.lovable.app/owners";

export const Route = createFileRoute("/owners")({
  staticData: { sitemap: false },
  head: () => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: "For owners — PropWise AI" },
      { name: "description", content: "Owners and developers can list a property with recorded permission. Submissions are moderated before publication." },
      { property: "og:title", content: "For owners — PropWise AI" },
      { property: "og:description", content: "Submit your own property with recorded permission." },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnersPage,
});

function OwnersPage() {
  const open = useFlag("feature_owner_submissions");
  if (!open) {
    return (
      <NotOpenYet title="For owners">
        Listing your own property will open here. Every submission needs a signed-in owner or developer, recorded permission and a review
        before it can appear. We never copy listings from other portals.
      </NotOpenYet>
    );
  }
  return <OwnersOpen />;
}

function OwnersOpen() {
  const { session } = useSession();
  const mine = useQuery({
    queryKey: ["my-submissions", session?.user.id],
    enabled: !!session,
    queryFn: mySubmissions,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-4xl">For owners</h1>
      <p className="mt-2 text-muted-foreground">
        List your own property directly. We do not charge for listings, we do not take a commission, and we do not copy listings from other
        websites. Every submission is reviewed before it appears, and your contact details are never published.
      </p>

      <div className="mt-8"><OwnerSubmissionForm /></div>

      {session && (
        <section className="mt-10">
          <h2 className="text-2xl">Your submissions</h2>
          {mine.isLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
          ) : (mine.data ?? []).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">You have not submitted a property yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {(mine.data ?? []).map((s) => (
                <li key={s.id} className="rounded-xl border bg-card p-4 shadow-card">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{s.property_type.replace(/_/g, " ")} in {s.locality_slug.replace(/-/g, " ")}</p>
                    <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${statusTone(s.status)}`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Sent {new Date(s.created_at).toLocaleDateString("en-IN")}</p>
                  {s.review_reason && <p className="mt-2 text-sm">Reviewer note: {s.review_reason}</p>}
                  {s.created_property_id && (
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link to="/properties/$id" params={{ id: s.created_property_id }}>View the listing</Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
