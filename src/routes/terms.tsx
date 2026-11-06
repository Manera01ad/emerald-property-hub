import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { siteUrl } from "@/lib/site";

export const Route = createFileRoute("/terms")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: siteUrl("/terms") }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: siteUrl("/terms") },
      { title: "Terms of Use — PropWise AI" },
      { name: "description", content: "Terms governing use of the PropWise AI property comparison and consulting platform." },
      { property: "og:title", content: "Terms of Use — PropWise AI" },
      { property: "og:description", content: "Terms for using PropWise AI." },
    ],
  }),
  component: () => (
    <LegalPage title="Terms of Use">
      <p>By using PropWise AI you agree to these terms.</p>
      <h2>Information on this site</h2>
      <p>Listings are provided by owners, developers and agents with their permission. Each listing shows its source and verification status. Cost estimates and deal scores are indicative only.</p>
      <h2>Our role</h2>
      <p>PropWise AI is a property consulting and comparison service. We may receive a commission from developers or sellers when a transaction completes; this does not change the price you pay.</p>
      <h2>Your responsibility</h2>
      <p>Buyers should independently verify title, approvals, RERA registration and all documents with a qualified lawyer before making any payment.</p>
      <h2>Liability</h2>
      <p>PropWise AI is not liable for decisions made solely on information displayed on this website.</p>
    </LegalPage>
  ),
});
