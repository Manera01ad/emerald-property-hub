import { createFileRoute } from "@tanstack/react-router";
import { NotOpenYet } from "@/components/NotOpenYet";
import { useFlag } from "@/lib/use-flag";

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
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <h1 className="text-4xl">For owners</h1>
      <p className="mt-2 text-muted-foreground">The submission form arrives in a later step of Phase 1.</p>
    </div>
  );
}
