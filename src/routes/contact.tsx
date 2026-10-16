import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { EnquiryForm } from "@/components/EnquiryForm";
import { useSettings, whatsappLink } from "@/lib/data";

export const Route = createFileRoute("/contact")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/contact" }],
    meta: [
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/contact" },
      { title: "Contact PropWise AI — Chennai Property Consultants" },
      { name: "description", content: "Get in touch with PropWise AI by phone, WhatsApp or email." },
      { property: "og:title", content: "Contact PropWise AI" },
      { property: "og:description", content: "Reach our Chennai property consulting team." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: s } = useSettings();
  const wa = whatsappLink(s?.whatsapp_number, "Hi PropWise");
  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 lg:grid-cols-2">
      <div>
        <h1 className="text-4xl">Contact us</h1>
        <p className="mt-3 text-muted-foreground">Serving Chennai and nearby Tamil Nadu.</p>
        <div className="mt-8 space-y-4 text-sm">
          {s?.contact_phone && <p className="flex items-center gap-2"><Phone className="size-4 text-gold" /> {s.contact_phone}</p>}
          {s?.contact_email && <p className="flex items-center gap-2"><Mail className="size-4 text-gold" /> {s.contact_email}</p>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline"><MessageCircle className="size-4 text-gold" /> WhatsApp</a>}
          {!s?.contact_phone && !s?.contact_email && !wa && <p className="text-muted-foreground">Use the form and we'll get back to you.</p>}
          {s?.rera_agent_status && <p className="text-xs text-muted-foreground">TNRERA agent registration: {s.rera_agent_status}</p>}
        </div>
      </div>
      <div className="rounded-xl border bg-card p-6 shadow-card"><EnquiryForm type="consultation" /></div>
    </div>
  );
}
