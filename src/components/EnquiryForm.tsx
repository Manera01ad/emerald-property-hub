import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MARKETS, PROPERTY_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.string().trim().regex(/^[+0-9 ()-]{6,20}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  budget: z.number().positive().optional(),
  message: z.string().max(2000).optional(),
  consent: z.literal(true, { errorMap: () => ({ message: "Consent is required" }) }),
});

export function EnquiryForm({
  type,
  propertyId,
  propertyTitle,
}: {
  type: "consultation" | "site_visit";
  propertyId?: string;
  propertyTitle?: string;
}) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locs, setLocs] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const budgetRaw = String(f.get("budget") || "").trim();
    const parsed = schema.safeParse({
      name: f.get("name"),
      phone: f.get("phone"),
      email: f.get("email") || "",
      budget: budgetRaw ? Number(budgetRaw) * 100000 : undefined,
      message: String(f.get("message") || "") || undefined,
      consent,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const bedrooms = String(f.get("bedrooms") || "");
    const visit = String(f.get("visit_date") || "");
    const { error } = await supabase.from("enquiries").insert({
      enquiry_type: type,
      property_id: propertyId ?? null,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      budget: parsed.data.budget ?? null,
      message: parsed.data.message ?? null,
      preferred_locations: locs,
      property_types: types,
      bedrooms: bedrooms ? Number(bedrooms) : null,
      preferred_visit_date: visit || null,
      consent: true,
    });
    setBusy(false);
    if (error) {
      toast.error("Could not send your request. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done)
    return (
      <div className="rounded-xl border bg-secondary p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" />
        <p className="mt-3 font-display text-xl">Request received</p>
        <p className="mt-1 text-sm text-muted-foreground">Our consultant will contact you shortly.</p>
      </div>
    );

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary",
    );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {propertyTitle && (
        <p className="text-sm text-muted-foreground">
          {type === "site_visit" ? "Site visit for" : "About"}: <span className="font-medium text-foreground">{propertyTitle}</span>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="name">Full name *</Label><Input id="name" name="name" maxLength={120} required /></div>
        <div className="space-y-1.5"><Label htmlFor="phone">Phone / WhatsApp *</Label><Input id="phone" name="phone" maxLength={20} required /></div>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" maxLength={200} /></div>
        <div className="space-y-1.5"><Label htmlFor="budget">All-inclusive budget (₹ lakhs)</Label><Input id="budget" name="budget" type="number" min={1} step="0.5" /></div>
        <div className="space-y-1.5"><Label htmlFor="bedrooms">Bedrooms</Label><Input id="bedrooms" name="bedrooms" type="number" min={0} max={10} /></div>
        {type === "site_visit" && (
          <div className="space-y-1.5"><Label htmlFor="visit_date">Preferred visit date</Label><Input id="visit_date" name="visit_date" type="date" /></div>
        )}
      </div>
      {!propertyId && (
        <>
          <div className="space-y-2">
            <Label>Preferred locations</Label>
            <div className="flex flex-wrap gap-2">
              {MARKETS.map((m) => (
                <button type="button" key={m} className={chip(locs.includes(m))} onClick={() => setLocs(locs.includes(m) ? locs.filter((x) => x !== m) : [...locs, m])}>{m}</button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Property types</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <button type="button" key={t.value} className={chip(types.includes(t.value))} onClick={() => setTypes(types.includes(t.value) ? types.filter((x) => x !== t.value) : [...types, t.value])}>{t.label}</button>
              ))}
            </div>
          </div>
        </>
      )}
      <div className="space-y-1.5"><Label htmlFor="message">Anything else?</Label><Textarea id="message" name="message" maxLength={2000} rows={3} /></div>
      <label className="flex items-start gap-2 text-sm text-muted-foreground">
        <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" />
        <span>I agree to be contacted by PropWise AI by phone, WhatsApp or email about my enquiry, and accept the Privacy Policy.</span>
      </label>
      <Button type="submit" variant="gold" size="lg" disabled={busy} className="w-full">
        {busy ? "Sending…" : type === "site_visit" ? "Request site visit" : "Request consultation"}
      </Button>
    </form>
  );
}
