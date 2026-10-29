import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/lib/auth";
import { useFlag } from "@/lib/use-flag";
import { INTEREST_CONSENT_TEXT, INTEREST_CONSENT_VERSION, interestRow, validateInterest } from "@/lib/interest";

/**
 * Interest in an approved owner listing. Signed in only, consent recorded with the wording
 * version, and no owner contact details are shown to the buyer at any point.
 */
export function InterestRequestButton({ propertyId, propertyTitle }: { propertyId: string; propertyTitle: string }) {
  const open = useFlag("feature_interest_requests");
  const { session } = useSession();
  const [showing, setShowing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (!open) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const check = validateInterest({ consent, message });
    if (!check.ok) { toast.error(check.error); return; }
    if (!name.trim() || !/^[+0-9 ()-]{6,20}$/.test(phone.trim())) { toast.error("Please give your name and a phone number we can reach you on."); return; }
    setBusy(true);
    const { error } = await supabase.from("enquiries").insert(interestRow({
      propertyId,
      name,
      phone,
      email: session?.user.email ?? null,
      message,
    }) as never);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setShowing(true)}>I am interested</Button>
      <Dialog open={showing} onOpenChange={setShowing}>
        <DialogContent>
          <DialogHeader><DialogTitle>Interest in {propertyTitle}</DialogTitle></DialogHeader>
          {!session ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Interest requests need a signed-in account, so we know who is asking and can record your consent.</p>
              <Button asChild variant="gold"><Link to="/auth">Sign in</Link></Button>
            </div>
          ) : sent ? (
            <p className="text-sm">Thank you — we have your interest and will come back to you. We do not pass the owner's contact details to buyers; we arrange next steps ourselves.</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="int-name">Your name</Label><Input id="int-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="int-phone">Phone</Label><Input id="int-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="int-message">What would you like to know?</Label><Textarea id="int-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{INTEREST_CONSENT_TEXT}</p>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                  I agree. Consent version {INTEREST_CONSENT_VERSION} is stored with my request.
                </label>
              </div>
              <Button type="submit" variant="gold" disabled={busy}>{busy ? "Sending…" : "Send my interest"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
