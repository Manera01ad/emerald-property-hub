import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/privacy" }],
    meta: [
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/privacy" },
      { title: "Privacy Policy — PropWise AI" },
      { name: "description", content: "How PropWise AI collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — PropWise AI" },
      { property: "og:description", content: "How we handle your enquiry data." },
    ],
  }),
  component: () => (
    <LegalPage title="Privacy Policy">
      <p>PropWise AI collects only the information you choose to share through our enquiry and site-visit forms: name, phone, email, budget and property preferences.</p>
      <h2>How we use it</h2>
      <ul><li>To contact you about your enquiry by phone, WhatsApp or email.</li><li>To arrange site visits and consultations.</li><li>We never sell your data.</li></ul>
      <h2>Who can see it</h2>
      <p>Enquiries are stored securely and visible only to authorised PropWise administrators. We may share your contact details with a developer or owner only when you request a site visit for their property.</p>
      <h2>Your rights</h2>
      <p>You can ask us to view, correct or delete your information at any time via the Contact page, in line with India's Digital Personal Data Protection Act, 2023.</p>
    </LegalPage>
  ),
});
