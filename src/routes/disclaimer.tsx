import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/disclaimer")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/disclaimer" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/disclaimer" },
      { title: "Disclaimer & RERA — PropWise AI" },
      { name: "description", content: "Estimates, verification labels and RERA information on PropWise AI." },
      { property: "og:title", content: "Disclaimer & RERA — PropWise AI" },
      { property: "og:description", content: "How to read estimates and verification labels." },
    ],
  }),
  component: () => (
    <LegalPage title="Disclaimer & RERA">
      <h2>Estimates</h2>
      <p>Stamp duty, registration fee and total cost figures use configurable Tamil Nadu rates and are calculated on the higher of the asking price or recorded guideline value. Actual charges are determined by the Sub-Registrar office.</p>
      <h2>Labels</h2>
      <ul>
        <li><b>Verified</b> — our team has checked evidence for the listing.</li>
        <li><b>Partially verified</b> — some details are confirmed.</li>
        <li><b>Unverified</b> — information as supplied by the source, not yet checked.</li>
        <li><b>Missing</b> documents are shown in red on every listing.</li>
      </ul>
      <h2>No appreciation forecasts</h2>
      <p>We do not predict or guarantee property appreciation or returns.</p>
      <h2>RERA</h2>
      <p>Projects requiring registration under the Real Estate (Regulation and Development) Act, 2016 should display a Tamil Nadu RERA (TNRERA) registration number. Where provided, it is shown on the listing. Verify at the official TNRERA portal: rera.tn.gov.in. PropWise AI's own agent registration number will be displayed here once issued.</p>
    </LegalPage>
  ),
});
