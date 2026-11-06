import { createFileRoute } from "@tanstack/react-router";
import { NotOpenYet } from "@/components/NotOpenYet";
import { NewThreadForm, ThreadList } from "@/components/Community";
import { useFlag } from "@/lib/use-flag";
import { siteUrl } from "@/lib/site";

const URL = siteUrl("/community");

export const Route = createFileRoute("/community")({
  staticData: { sitemap: false },
  head: () => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: "Community — PropWise AI" },
      { name: "description", content: "Buyer questions and local knowledge for Chennai suburbs, moderated before publication." },
      { property: "og:title", content: "Community — PropWise AI" },
      { property: "og:description", content: "Moderated buyer discussion about Chennai localities." },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const open = useFlag("feature_community");
  if (!open) {
    return (
      <NotOpenYet title="Community">
        When it opens you will be able to ask other buyers questions about a locality. Posts are moderated before they appear, and phone
        numbers and email addresses are not published.
      </NotOpenYet>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-4xl">Community</h1>
      <p className="mt-2 text-muted-foreground">
        Ask other buyers about a locality. Posts are moderated before they appear, phone numbers and email addresses are not allowed, and
        three reports hide a post until a person reviews it.
      </p>
      <div className="mt-8"><NewThreadForm /></div>
      <section className="mt-10">
        <h2 className="text-2xl">Threads</h2>
        <div className="mt-3"><ThreadList /></div>
      </section>
    </div>
  );
}
