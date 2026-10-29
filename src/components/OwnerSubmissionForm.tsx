import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROPERTY_TYPES } from "@/lib/constants";
import { useLocalities } from "@/lib/data";
import { useSession } from "@/lib/auth";
import { createSubmission } from "@/lib/submissions-data";
import { DECLARATION_TEXT, DECLARATION_VERSION, validateSubmission, type SubmitInput } from "@/lib/submissions";
import { TransactionSelector } from "@/components/TransactionSelector";
import { TRANSACTION_LABELS, asTransactionType, type TransactionType } from "@/lib/transaction";

const sel = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

const EMPTY: SubmitInput = {
  submitterKind: "owner", name: "", phone: "", email: "", reraNumber: "", localitySlug: "",
  propertyType: "villa", transactionType: "buy", bedrooms: "", builtArea: "", landArea: "", askingPrice: "",
  deposit: "", maintenanceMonthly: "", furnishing: "", availableFrom: "",
  leaseMonths: "", escalationPct: "", permittedUse: "", renewalTerms: "",
  description: "", declared: false, honeypot: "",
};

const num = (v: string) => (v.trim() ? Number(v) : null);

/**
 * Owner and developer submissions. Sign-in is required, the locality is chosen from the
 * controlled list, photos are deliberately not collected, and a hidden field catches bots.
 * Nothing is public until an admin reviews it.
 */
export function OwnerSubmissionForm() {
  const { session } = useSession();
  const { data: localities = [] } = useLocalities();
  const [f, setF] = useState<SubmitInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (patch: Partial<SubmitInput>) => setF((s) => ({ ...s, ...patch }));
  const type: TransactionType = asTransactionType(f.transactionType);
  const isMonthly = type !== "buy";
  const isLease = type === "lease";

  if (!session) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center">
        <p className="font-medium">Sign in to submit a property</p>
        <p className="mt-1 text-sm text-muted-foreground">We need a signed-in account with a verified email so we can reach you about your submission.</p>
        <Button asChild variant="gold" className="mt-4"><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validateSubmission(f);
    setErrors(check.ok ? {} : check.errors);
    if (!check.ok) { toast.error("Please check the highlighted fields."); return; }
    setBusy(true);
    try {
      await createSubmission({
        submitter_id: session!.user.id,
        submitter_kind: f.submitterKind,
        submitter_name: f.name.trim(),
        contact_phone: f.phone.trim(),
        contact_email: f.email.trim(),
        rera_number: f.submitterKind === "developer" ? f.reraNumber.trim() : null,
        locality_slug: f.localitySlug,
        property_type: f.propertyType,
        transaction_type: f.transactionType,
        bedrooms: f.bedrooms.trim() ? Number(f.bedrooms) : null,
        built_area_sqft: num(f.builtArea),
        land_area_sqft: num(f.landArea),
        asking_price: num(f.askingPrice),
        // Terms are sent only for the type that uses them, so a sale never carries a deposit.
        deposit: isMonthly ? num(f.deposit) : null,
        maintenance_monthly: isMonthly ? num(f.maintenanceMonthly) : null,
        furnishing: isMonthly ? f.furnishing || null : null,
        available_from: isMonthly ? f.availableFrom || null : null,
        lease_months: isLease ? num(f.leaseMonths) : null,
        escalation_pct: isLease ? num(f.escalationPct) : null,
        permitted_use: isLease ? f.permittedUse || null : null,
        renewal_terms: isLease ? f.renewalTerms || null : null,
        description: f.description.trim() || null,
        declaration_version: DECLARATION_VERSION,
        declaration_text: DECLARATION_TEXT,
      });
    } catch (e) {
      toast.error((e as Error).message);
      return;
    } finally {
      setBusy(false);
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-card">
        <p className="text-xl font-medium">Thank you — your submission is with us</p>
        <p className="mt-2 text-sm text-muted-foreground">
          An admin will review it. We may come back to you with questions. Nothing appears publicly until it is approved, and the review never exposes your contact details.
        </p>
        <Button asChild variant="outline" className="mt-4"><Link to="/owners">Submit another</Link></Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="space-y-2">
        <Label>What are you listing it for?</Label>
        <TransactionSelector
          value={type}
          onChange={(t) => set({ transactionType: t, ...(t !== "buy" && f.propertyType === "plot" ? { propertyType: "villa" } : {}) })}
        />
        <p className="text-xs text-muted-foreground">
          One listing, three ways to offer it. A sale states a price; {TRANSACTION_LABELS.rent.toLowerCase()} and{" "}
          {TRANSACTION_LABELS.lease.toLowerCase()} state a monthly figure and their own terms.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sub-kind">I am the</Label>
          <select id="sub-kind" className={sel} value={f.submitterKind} onChange={(e) => set({ submitterKind: e.target.value as SubmitInput["submitterKind"] })}>
            <option value="owner">Owner</option>
            <option value="developer">Developer</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-name">Your name</Label>
          <Input id="sub-name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
          {errors["name"] && <p className="text-xs text-destructive">{errors["name"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-phone">Phone</Label>
          <Input id="sub-phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          {errors["phone"] && <p className="text-xs text-destructive">{errors["phone"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-email">Email</Label>
          <Input id="sub-email" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
          {errors["email"] && <p className="text-xs text-destructive">{errors["email"]}</p>}
        </div>
        {f.submitterKind === "developer" && (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="sub-rera">TNRERA registration number</Label>
            <Input id="sub-rera" value={f.reraNumber} onChange={(e) => set({ reraNumber: e.target.value })} />
            {errors["reraNumber"] && <p className="text-xs text-destructive">{errors["reraNumber"]}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="sub-locality">Locality</Label>
          <select id="sub-locality" className={sel} value={f.localitySlug} onChange={(e) => set({ localitySlug: e.target.value })}>
            <option value="">Choose a locality</option>
            {localities.map((l) => <option key={l.id} value={l.slug}>{l.name}</option>)}
          </select>
          {errors["localitySlug"] && <p className="text-xs text-destructive">{errors["localitySlug"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-type">Property type</Label>
          <select id="sub-type" className={sel} value={f.propertyType} onChange={(e) => set({ propertyType: e.target.value })}>
            {PROPERTY_TYPES.filter((t) => !isMonthly || t.value !== "plot").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-bedrooms">Bedrooms</Label>
          <Input id="sub-bedrooms" inputMode="numeric" value={f.bedrooms} onChange={(e) => set({ bedrooms: e.target.value.replace(/[^\d]/g, "") })} />
          {errors["bedrooms"] && <p className="text-xs text-destructive">{errors["bedrooms"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-built">Built area (sq ft)</Label>
          <Input id="sub-built" inputMode="numeric" value={f.builtArea} onChange={(e) => set({ builtArea: e.target.value.replace(/[^\d.]/g, "") })} />
          {errors["builtArea"] && <p className="text-xs text-destructive">{errors["builtArea"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-land">Land area (sq ft)</Label>
          <Input id="sub-land" inputMode="numeric" value={f.landArea} onChange={(e) => set({ landArea: e.target.value.replace(/[^\d.]/g, "") })} />
          {errors["landArea"] && <p className="text-xs text-destructive">{errors["landArea"]}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sub-price">{isMonthly ? "Monthly rent (₹)" : "Asking price (₹)"}</Label>
          <Input id="sub-price" inputMode="numeric" value={f.askingPrice} onChange={(e) => set({ askingPrice: e.target.value.replace(/[^\d]/g, "") })} />
          {errors["askingPrice"] && <p className="text-xs text-destructive">{errors["askingPrice"]}</p>}
        </div>
        {isMonthly && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sub-deposit">Deposit (₹)</Label>
              <Input id="sub-deposit" inputMode="numeric" value={f.deposit} onChange={(e) => set({ deposit: e.target.value.replace(/[^\d]/g, "") })} />
              {errors["deposit"] && <p className="text-xs text-destructive">{errors["deposit"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-maint">Monthly maintenance (₹)</Label>
              <Input id="sub-maint" inputMode="numeric" value={f.maintenanceMonthly} onChange={(e) => set({ maintenanceMonthly: e.target.value.replace(/[^\d]/g, "") })} />
              {errors["maintenanceMonthly"] && <p className="text-xs text-destructive">{errors["maintenanceMonthly"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-furnishing">Furnishing</Label>
              <select id="sub-furnishing" className={sel} value={f.furnishing} onChange={(e) => set({ furnishing: e.target.value })}>
                <option value="">Not stated</option>
                <option value="unfurnished">Unfurnished</option>
                <option value="semi_furnished">Semi-furnished</option>
                <option value="fully_furnished">Fully furnished</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-available">Available from</Label>
              <Input id="sub-available" type="date" value={f.availableFrom} onChange={(e) => set({ availableFrom: e.target.value })} />
            </div>
          </>
        )}
        {isLease && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="sub-lease-months">Lease duration (months)</Label>
              <Input id="sub-lease-months" inputMode="numeric" value={f.leaseMonths} onChange={(e) => set({ leaseMonths: e.target.value.replace(/[^\d]/g, "") })} />
              {errors["leaseMonths"] && <p className="text-xs text-destructive">{errors["leaseMonths"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-escalation">Annual escalation (%)</Label>
              <Input id="sub-escalation" inputMode="numeric" value={f.escalationPct} onChange={(e) => set({ escalationPct: e.target.value.replace(/[^\d.]/g, "") })} />
              {errors["escalationPct"] && <p className="text-xs text-destructive">{errors["escalationPct"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-use">Permitted use</Label>
              <select id="sub-use" className={sel} value={f.permittedUse} onChange={(e) => set({ permittedUse: e.target.value })}>
                <option value="">Not stated</option>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="office">Office</option>
                <option value="retail">Retail</option>
                <option value="industrial">Industrial</option>
                <option value="mixed">Mixed use</option>
              </select>
              {errors["permittedUse"] && <p className="text-xs text-destructive">{errors["permittedUse"]}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-renewal">Renewal</Label>
              <select id="sub-renewal" className={sel} value={f.renewalTerms} onChange={(e) => set({ renewalTerms: e.target.value })}>
                <option value="">Not stated</option>
                <option value="renewable">Renewable</option>
                <option value="not_renewable">Not renewable</option>
                <option value="by_agreement">By fresh agreement at the end of the term</option>
              </select>
              {errors["renewalTerms"] && <p className="text-xs text-destructive">{errors["renewalTerms"]}</p>}
            </div>
          </>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sub-desc">Anything a {isMonthly ? "tenant or lessee" : "buyer"} should know</Label>
        <Textarea id="sub-desc" rows={4} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        {errors["description"] && <p className="text-xs text-destructive">{errors["description"]}</p>}
      </div>

      {/* Hidden from people, tempting to bots. A filled value fails validation. */}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="sub-company">Company</label>
        <input id="sub-company" tabIndex={-1} autoComplete="off" value={f.honeypot} onChange={(e) => set({ honeypot: e.target.value })} />
      </div>

      <div className="rounded-lg border bg-muted/40 p-4">
        <p className="text-sm font-medium">Declaration</p>
        <p className="mt-1 text-sm text-muted-foreground">{DECLARATION_TEXT}</p>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <Checkbox checked={f.declared} onCheckedChange={(v) => set({ declared: v === true })} />
          I accept this declaration. It is stored with my submission, version {DECLARATION_VERSION}.
        </label>
        {errors["declared"] && <p className="text-xs text-destructive">{errors["declared"]}</p>}
      </div>

      <p className="text-xs text-muted-foreground">We do not collect photos here yet, and we never copy listings from other websites.</p>
      <Button type="submit" variant="gold" disabled={busy}>{busy ? "Sending…" : "Submit for review"}</Button>
    </form>
  );
}
