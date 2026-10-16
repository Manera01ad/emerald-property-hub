import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { EnquiryForm } from "@/components/EnquiryForm";
import { Button } from "@/components/ui/button";
import { useSettings, whatsappLink } from "@/lib/data";

export const Route = createFileRoute("/consult")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/consult" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/consult" },
      { title: "Book a Property Consultation — PropWise AI" },
      { name: "description", content: "Tell us your budget and preferences. Our Chennai property consultants help you shortlist, verify and negotiate." },
      { property: "og:title", content: "Book a Property Consultation — PropWise AI" },
      { property: "og:description", content: "Expert help shortlisting, verifying documents and negotiating in Chennai." },
    ],
  }),
  component: ConsultPage,
});

function ConsultPage() {
  const { data: s } = useSettings();
  const wa = whatsappLink(s?.whatsapp_number, "Hi PropWise, I'd like a property consultation.");
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-gold">Buyer consulting</p>
        <h1 className="mt-3 text-4xl">Buy with an expert on your side</h1>
        <ul className="mt-6 space-y-3 text-muted-foreground">
          <li>• Shortlisting based on your all-inclusive budget</li>
          <li>• Document checklist and approval review</li>
          <li>• Accompanied site visits</li>
          <li>• Price negotiation support</li>
        </ul>
        {wa && <Button asChild variant="outline" className="mt-8"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Chat on WhatsApp</a></Button>}
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-card md:p-8">
        <EnquiryForm type="consultation" />
      </div>
    </div>
  );
}
